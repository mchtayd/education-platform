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
        private readonly IEmailSender _email;

        public AuthController(AppDbContext db, ITokenService tokens, IEmailSender email)
        {
            _db = db;
            _tokens = tokens;
            _email = email;
        }

        // JWT'den userId okuma (farklı claim adlarına tolerant)
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

        // 6 haneli kod üret
        private static string Generate6DigitCode()
        {
            var bytes = RandomNumberGenerator.GetBytes(4);
            var n = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
            return n.ToString("D6");
        }

        // email + code + salt => SHA256
        private static string HashCode(string emailLower, string code, string salt)
        {
            var raw = $"{emailLower}|{code}|{salt}";
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(hash);
        }

        // reset token hash (forgot password)
        private static string HashResetToken(string emailLower, string token, string salt)
        {
            var raw = $"{emailLower}|{token}|{salt}";
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(hash);
        }

        private static string GenerateResetToken()
        {
            // URL-safe token
            var bytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToBase64String(bytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');
        }

        // =========================================================
        // ✅ 0) FORGOT PASSWORD - KULLANICI VAR MI KONTROL ET
        // POST /api/Auth/forgot-password/check
        // =========================================================
        [HttpPost("forgot-password/check")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPasswordCheck([FromBody] ForgotPasswordCheckDto dto)
        {
            var email = (dto.Email ?? "").Trim();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "E-posta zorunludur." });

            var emailLower = email.ToLowerInvariant();

            var user = await _db.Users.AsNoTracking()
                .Select(u => new { u.Id, u.Email, u.IsActive })
                .FirstOrDefaultAsync(u => u.Email.ToLower() == emailLower);

            var hasPendingRequest = await _db.AccountRequests.AsNoTracking()
                .AnyAsync(r => r.Email.ToLower() == emailLower);

            if (user is null)
            {
                return Ok(new { exists = false, hasPendingRequest });
            }

            return Ok(new { exists = true, isActive = user.IsActive, hasPendingRequest = false });
        }

        // =========================================================
        // ✅ 1) FORGOT PASSWORD - KOD GÖNDER
        // POST /api/Auth/forgot-password/send-code
        // =========================================================
        [HttpPost("forgot-password/send-code")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPasswordSendCode([FromBody] ForgotPasswordSendCodeDto dto)
        {
            var email = (dto.Email ?? "").Trim();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "E-posta zorunludur." });

            var emailLower = email.ToLowerInvariant();

            // 1) kullanıcı var mı?
            var userExists = await _db.Users.AsNoTracking().AnyAsync(u => u.Email.ToLower() == emailLower);
            if (!userExists)
            {
                // İsteğine göre: kayıtlı değilse net söyle
                return Ok(new { exists = false, message = "Bu e-posta ile kayıtlı kullanıcı bulunamadı." });
            }

            // 2) kod üret
            var code = Generate6DigitCode();
            var salt = Guid.NewGuid().ToString("N");
            var codeHash = HashCode(emailLower, code, salt);
            var now = DateTimeOffset.UtcNow;
            var expiresAt = now.AddMinutes(10);

            // aynı email + purpose için aktif kayıt varsa güncelle
            var ver = await _db.EmailVerifications
                .OrderByDescending(x => x.Id)
                .FirstOrDefaultAsync(x =>
                    x.Email.ToLower() == emailLower &&
                    x.Purpose == "forgot_password" &&
                    x.UsedAt == null &&
                    x.ExpiresAt > now);

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
                    Purpose = "forgot_password",
                    ResetSalt = null,
                    ResetHash = null,
                    UsedAt = null
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
                ver.ResetSalt = null;
                ver.ResetHash = null;
                ver.UsedAt = null;
            }

            await _db.SaveChangesAsync();

            // 3) mail gönder
            await _email.SendAsync(
                toEmail: emailLower,
                subject: "Eğitim Platformu - Şifre Sıfırlama Kodu",
                htmlBody: $@"
                    <div style=""font-family:Arial,sans-serif"">
                      <h3>Şifre Sıfırlama</h3>
                      <p>Şifre sıfırlama kodunuz:</p>
                      <div style=""font-size:28px;font-weight:700;letter-spacing:4px"">{code}</div>
                      <p>Kod <b>10 dakika</b> geçerlidir.</p>
                    </div>"
            );

            return Ok(new
            {
                exists = true,
                message = "Şifre sıfırlama kodu gönderildi.",
                verificationId = ver.Id,
                expiresAt = ver.ExpiresAt
            });
        }

        // =========================================================
        // ✅ 2) FORGOT PASSWORD - KODU DOĞRULA ve RESET TOKEN ÜRET
        // POST /api/Auth/forgot-password/verify-code
        // =========================================================
        [HttpPost("forgot-password/verify-code")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPasswordVerifyCode([FromBody] ForgotPasswordVerifyCodeDto dto)
        {
            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            var code = (dto.Code ?? "").Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return BadRequest(new { message = "E-posta ve kod zorunludur." });

            var now = DateTimeOffset.UtcNow;

            var ver = await _db.EmailVerifications
                .FirstOrDefaultAsync(x =>
                    x.Id == dto.VerificationId &&
                    x.Email.ToLower() == email &&
                    x.Purpose == "forgot_password");

            if (ver is null)
                return NotFound(new { message = "Doğrulama kaydı bulunamadı." });

            if (ver.UsedAt != null)
                return Ok(new { message = "Kod zaten kullanılmış." });

            if (ver.ExpiresAt <= now)
                return BadRequest(new { message = "Kod süresi doldu. Tekrar kod isteyin." });

            if (ver.Attempts >= 5)
                return BadRequest(new { message = "Çok fazla deneme yapıldı. Yeni kod isteyin." });

            var expected = HashCode(email, code, ver.Salt);
            if (!string.Equals(expected, ver.CodeHash, StringComparison.OrdinalIgnoreCase))
            {
                ver.Attempts += 1;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Kod hatalı." });
            }

            // ✅ Kod doğru -> reset token üret (UI bunu saklayacak ve reset endpointine gönderecek)
            var resetToken = GenerateResetToken();
            var resetSalt = Guid.NewGuid().ToString("N");
            var resetHash = HashResetToken(email, resetToken, resetSalt);

            ver.ResetSalt = resetSalt;
            ver.ResetHash = resetHash;

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Kod doğrulandı. Yeni şifre belirleyebilirsiniz.",
                verificationId = ver.Id,
                resetToken = resetToken
            });
        }

        // =========================================================
        // ✅ 3) FORGOT PASSWORD - YENİ ŞİFRE BELİRLE
        // POST /api/Auth/forgot-password/reset
        // =========================================================
        [HttpPost("forgot-password/reset")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPasswordReset([FromBody] ForgotPasswordResetDto dto)
        {
            var email = (dto.Email ?? "").Trim().ToLowerInvariant();
            var resetToken = (dto.ResetToken ?? "").Trim();
            var newPassword = dto.NewPassword ?? "";

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(resetToken) || string.IsNullOrWhiteSpace(newPassword))
                return BadRequest(new { message = "E-posta, reset token ve yeni şifre zorunludur." });

            var now = DateTimeOffset.UtcNow;

            var ver = await _db.EmailVerifications
                .FirstOrDefaultAsync(x =>
                    x.Id == dto.VerificationId &&
                    x.Email.ToLower() == email &&
                    x.Purpose == "forgot_password");

            if (ver is null)
                return NotFound(new { message = "Doğrulama kaydı bulunamadı." });

            if (ver.UsedAt != null)
                return BadRequest(new { message = "Bu sıfırlama bağlantısı/kodu zaten kullanılmış." });

            if (ver.ExpiresAt <= now)
                return BadRequest(new { message = "Sıfırlama süresi doldu. Tekrar kod isteyin." });

            if (string.IsNullOrWhiteSpace(ver.ResetSalt) || string.IsNullOrWhiteSpace(ver.ResetHash))
                return BadRequest(new { message = "Önce kod doğrulaması yapmalısınız." });

            var expectedReset = HashResetToken(email, resetToken, ver.ResetSalt);
            if (!string.Equals(expectedReset, ver.ResetHash, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Reset token geçersiz." });

            // kullanıcıyı bul
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (user is null)
                return NotFound(new { message = "Kullanıcı bulunamadı." });

            // şifre güncelle
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.MustChangePassword = false; // istersen true da bırakabilirsin

            // bu doğrulama kaydını kullanıldı işaretle
            ver.UsedAt = now;

            await _db.SaveChangesAsync();

            return Ok(new { message = "Şifre başarıyla güncellendi. Giriş yapabilirsiniz." });
        }

        // =========================================================
        // ✅ Profil (me)
        // =========================================================
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

            if (await _db.Users.AnyAsync(x => x.Email.ToLower() == emailLower) ||
                await _db.AccountRequests.AnyAsync(x => x.Email.ToLower() == emailLower))
            {
                return Conflict(new { message = "Bu e-posta kullanımda." });
            }

            var code = Generate6DigitCode();
            var salt = Guid.NewGuid().ToString("N");
            var codeHash = HashCode(emailLower, code, salt);
            var now = DateTimeOffset.UtcNow;
            var expiresAt = now.AddMinutes(10);

            var ver = await _db.EmailVerifications
                .OrderByDescending(x => x.Id)
                .FirstOrDefaultAsync(x =>
                    x.Email.ToLower() == emailLower &&
                    x.Purpose == "register" &&
                    x.UsedAt == null &&
                    x.ExpiresAt > now);

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
                    Purpose = "register",
                    ResetSalt = null,
                    ResetHash = null,
                    UsedAt = null
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
                ver.ResetSalt = null;
                ver.ResetHash = null;
                ver.UsedAt = null;
            }

            await _db.SaveChangesAsync();

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
        // ✅ 2) REGISTER KODUNU DOĞRULA (UsedAt set)
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
                .FirstOrDefaultAsync(x =>
                    x.Id == dto.VerificationId &&
                    x.Email.ToLower() == email &&
                    x.Purpose == "register");

            if (ver is null)
                return NotFound(new { message = "Doğrulama kaydı bulunamadı." });

            if (ver.UsedAt != null)
                return Ok(new { message = "E-posta zaten doğrulandı." });

            if (ver.ExpiresAt <= now)
                return BadRequest(new { message = "Doğrulama kodu süresi doldu. Tekrar kod isteyin." });

            if (ver.Attempts >= 5)
                return BadRequest(new { message = "Çok fazla deneme yapıldı. Yeni kod isteyin." });

            var expected = HashCode(email, code, ver.Salt);
            if (!string.Equals(expected, ver.CodeHash, StringComparison.OrdinalIgnoreCase))
            {
                ver.Attempts += 1;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Kod hatalı." });
            }

            // ✅ doğrulandı işareti
            ver.UsedAt = now;
            await _db.SaveChangesAsync();

            return Ok(new { message = "E-posta doğrulandı." });
        }

        // =========================================================
        // ✅ REGISTER (Mevcut endpoint korunuyor)
        // Burada artık "mail doğrulandı mı?" kontrolü: UsedAt
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

            // ✅ E-POSTA DOĞRULAMA ZORUNLU (UsedAt üzerinden)
            var now = DateTimeOffset.UtcNow;
            var threshold = now.AddMinutes(-30);

            var verified = await _db.EmailVerifications.AnyAsync(x =>
                x.Email.ToLower() == emailLower &&
                x.Purpose == "register" &&
                x.UsedAt.HasValue &&
                x.UsedAt.Value > threshold
            );

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

        // =========================================================
        // LOGIN (aynı)
        // =========================================================
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
