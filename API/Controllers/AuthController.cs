// Controllers/AuthController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using API.Data;
using API.DTOs;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITokenService _tokens;
        private readonly IEmailSender _email; // ✅ e-posta servisi eklendi

        public AuthController(AppDbContext db, ITokenService tokens, IEmailSender email)
        {
            _db = db;
            _tokens = tokens;
            _email = email;
        }

        // ✅ JWT'den userId okuma (farklı claim adlarına tolerant)
        private int? GetUserId()
        {
            var keys = new[] { ClaimTypes.NameIdentifier, "nameid", "sub", "id", "userId" };
            foreach (var k in keys)
            {
                var v = User.FindFirst(k)?.Value;
                if (int.TryParse(v, out var id)) return id;
            }
            return null;
        }

        // -----------------------------
        // ✅ Helper: 6 haneli kod üret
        // -----------------------------
        private static string Generate6DigitCode()
        {
            // 000000 - 999999
            var bytes = RandomNumberGenerator.GetBytes(4);
            var n = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
            return n.ToString("D6");
        }

        // --------------------------------------------------------
        // ✅ Helper: Doğrulama kodunu DB’de saklamak için hash’le
        // (kodun kendisini DB’ye düz yazı kaydetmiyoruz)
        // --------------------------------------------------------
        private static string HashCode(string emailLower, string code, string salt)
        {
            // email + code + salt => SHA256
            var raw = $"{emailLower}|{code}|{salt}";
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(hash); // uppercase hex
        }

        // ✅ Profil (me)
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var uid = GetUserId();
            if (uid is null) return Unauthorized(new { message = "Oturum bulunamadı." });

            var data = await (
                from u in _db.Users.AsNoTracking()
                where u.Id == uid.Value
                join p in _db.Projects.AsNoTracking() on u.ProjectId equals p.Id into gp
                from p in gp.DefaultIfEmpty()
                select new
                {
                    id = u.Id,
                    name = u.Name,
                    surname = u.Surname,
                    email = u.Email,
                    phone = u.Phone,
                    institution = u.Institution,
                    businessAddress = u.BusinessAddress,
                    role = u.Role,
                    projectId = u.ProjectId,
                    projectName = p != null ? p.Name : null,
                    createdAt = u.CreatedAt,
                    mustChangePassword = u.MustChangePassword,
                }
            ).FirstOrDefaultAsync();

            if (data is null) return NotFound(new { message = "Kullanıcı bulunamadı." });
            return Ok(data);
        }

        // =========================================================
        // ✅ 1) REGISTER KODU GÖNDER
        // POST /api/Auth/send-register-code
        // =========================================================
        [HttpPost("send-register-code")]
        [AllowAnonymous]
        public async Task<IActionResult> SendRegisterCode([FromBody] SendRegisterCodeDto dto)
        {
            var email = (dto.Email ?? "").Trim();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "E-posta zorunludur." });

            var emailLower = email.ToLowerInvariant();

            // Mail zaten kullanımdaysa (user ya da pending request) kod göndermeyelim
            if (await _db.Users.AnyAsync(x => x.Email.ToLower() == emailLower) ||
                await _db.AccountRequests.AnyAsync(x => x.Email.ToLower() == emailLower))
            {
                return Conflict(new { message = "Bu e-posta kullanımda." });
            }

            // Kod üret
            var code = Generate6DigitCode();
            var salt = Guid.NewGuid().ToString("N");
            var codeHash = HashCode(emailLower, code, salt);
            var now = DateTimeOffset.UtcNow;
            var expiresAt = now.AddMinutes(10);

            // Aynı mail için aktif (expire olmamış) bir kayıt varsa güncelle
            var ver = await _db.EmailVerifications
                .OrderByDescending(x => x.Id)
                .FirstOrDefaultAsync(x => x.Email.ToLower() == emailLower && x.VerifiedAt == null && x.ExpiresAt > now);

            if (ver is null)
            {
                ver = new EmailVerification
                {
                    Email = emailLower,
                    Salt = salt,
                    CodeHash = codeHash,
                    CreatedAt = now,
                    ExpiresAt = expiresAt,
                    Attempts = 0,
                    VerifiedAt = null
                };
                _db.EmailVerifications.Add(ver);
            }
            else
            {
                ver.Salt = salt;
                ver.CodeHash = codeHash;
                ver.CreatedAt = now;
                ver.ExpiresAt = expiresAt;
                ver.Attempts = 0;
                ver.VerifiedAt = null;
            }

            await _db.SaveChangesAsync();

            // ✅ Mail gönder
            // Subject ve body’yi istediğin gibi tasarlayabilirsin
            await _email.SendAsync(
                toEmail: emailLower,
                subject: "Eğitim Platformu - Doğrulama Kodu",
                htmlBody: $@"
                    <div style=""font-family:Arial,sans-serif"">
                      <h3>E-posta doğrulama</h3>
                      <p>Doğrulama kodunuz:</p>
                      <div style=""font-size:28px;font-weight:700;letter-spacing:4px"">{code}</div>
                      <p>Kod <b>10 dakika</b> geçerlidir.</p>
                    </div>"
            );

            return Ok(new
            {
                message = "Doğrulama kodu gönderildi.",
                verificationId = ver.Id,
                expiresAt = ver.ExpiresAt
            });
        }

        // =========================================================
        // ✅ 2) REGISTER KODUNU DOĞRULA
        // POST /api/Auth/verify-register-code
        // =========================================================
        [HttpPost("verify-register-code")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyRegisterCode([FromBody] VerifyRegisterCodeDto dto)
        {
            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            var code = (dto.Code ?? "").Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return BadRequest(new { message = "E-posta ve kod zorunludur." });

            var now = DateTimeOffset.UtcNow;

            var ver = await _db.EmailVerifications
                .FirstOrDefaultAsync(x => x.Id == dto.VerificationId && x.Email.ToLower() == email);

            if (ver is null)
                return NotFound(new { message = "Doğrulama kaydı bulunamadı." });

            if (ver.VerifiedAt != null)
                return Ok(new { message = "E-posta zaten doğrulandı." });

            if (ver.ExpiresAt <= now)
                return BadRequest(new { message = "Doğrulama kodu süresi doldu. Tekrar kod isteyin." });

            // Basit brute-force önlemi
            if (ver.Attempts >= 5)
                return BadRequest(new { message = "Çok fazla deneme yapıldı. Yeni kod isteyin." });

            var expected = HashCode(email, code, ver.Salt);
            if (!string.Equals(expected, ver.CodeHash, StringComparison.OrdinalIgnoreCase))
            {
                ver.Attempts += 1;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Kod hatalı." });
            }

            ver.VerifiedAt = now;
            await _db.SaveChangesAsync();

            return Ok(new { message = "E-posta doğrulandı." });
        }

        // =========================================================
        // ✅ REGISTER (Mevcut endpoint korunuyor)
        // Burada artık "mail doğrulandı mı?" kontrolü var
        // =========================================================
        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            var email = (dto.Email ?? "").Trim();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "E-posta zorunludur." });

            var emailLower = email.ToLowerInvariant();

            if (await _db.Users.AnyAsync(x => x.Email.ToLower() == emailLower) ||
                await _db.AccountRequests.AnyAsync(x => x.Email.ToLower() == emailLower))
            {
                return Conflict(new { message = "Bu e-posta kullanımda." });
            }

            // ✅ E-POSTA DOĞRULAMA ZORUNLU
            // Kullanıcı register formunda önce kod doğrulamadan devam edemez.
            var now = DateTimeOffset.UtcNow;
            var verified = await _db.EmailVerifications
                .AnyAsync(x =>
                    x.Email.ToLower() == emailLower &&
                    x.VerifiedAt != null &&
                    x.VerifiedAt > now.AddMinutes(-30)); // doğrulama 30 dk içinde yapılmış olsun

            if (!verified)
                return BadRequest(new { message = "E-posta doğrulanmadı. Lütfen doğrulama kodunu onaylayın." });

            var hash = BCrypt.Net.BCrypt.HashPassword(dto.Password ?? "");

            var req = new AccountRequest
            {
                Name = dto.Name,
                Surname = dto.Surname,
                Email = email,
                Phone = dto.Phone,
                Institution = dto.Institution,
                BusinessAddress = dto.BusinessAddress,
                ProjectId = dto.ProjectId,
                PasswordHash = hash,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.AccountRequests.Add(req);
            await _db.SaveChangesAsync();

            return Accepted(new
            {
                message = "Hesap oluşturma talebiniz başarıyla iletilmiştir. Hesabınız aktifleştirildiğinde kayıtlı e-posta adresinize bildirim yapılacaktır."
            });
        }

        // LOGIN aynı kalıyor
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest dto)
        {
            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            var password = dto.Password ?? "";

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                return Unauthorized(new { message = "E-posta veya şifre hatalı." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user is null)
            {
                var hasPendingRequest = await _db.AccountRequests.AnyAsync(r => r.Email.ToLower() == email);
                if (hasPendingRequest)
                    return Unauthorized(new { message = "Hesabınız henüz aktifleştirilmedi. Lütfen admin onayını bekleyin." });

                return Unauthorized(new { message = "E-posta veya şifre hatalı." });
            }

            var ok = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
            if (!ok)
                return Unauthorized(new { message = "E-posta veya şifre hatalı." });

            if (!user.IsActive)
                return Unauthorized(new { message = "Hesabınız henüz aktifleştirilmedi. Lütfen admin onayını bekleyin." });

            var token = _tokens.CreateToken(user);

            var userShape = new
            {
                id = user.Id,
                name = user.Name,
                surname = user.Surname,
                email = user.Email,
                role = user.Role,
                phone = user.Phone,
                institution = user.Institution,
                mustChangePassword = user.MustChangePassword
            };

            return Ok(new LoginResponse(token, userShape));
        }
    }
}
