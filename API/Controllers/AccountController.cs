//Controllers/AccountController.cs
using System.Security.Claims;
using API.Data;
using API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // istersen [Authorize(Roles="admin")] yapabilirsin
    public class AccountController : ControllerBase
    {
        private readonly AppDbContext _db;
        public AccountController(AppDbContext db) => _db = db;

        private int GetUserId()
        {
            var idStr =
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue("id") ??
                User.FindFirstValue("sub");

            if (string.IsNullOrWhiteSpace(idStr))
                throw new UnauthorizedAccessException("User id claim bulunamadı.");

            return int.Parse(idStr);
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var userId = GetUserId();

            var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
            if (u == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

            var cur = (dto.CurrentPassword ?? "").Trim();
            var nw = (dto.NewPassword ?? "").Trim();

            if (string.IsNullOrWhiteSpace(cur) || string.IsNullOrWhiteSpace(nw))
                return BadRequest(new { message = "Mevcut şifre ve yeni şifre zorunludur." });

            if (nw.Length < 6)
                return BadRequest(new { message = "Yeni şifre en az 6 karakter olmalıdır." });

            if (cur == nw)
                return BadRequest(new { message = "Yeni şifre mevcut şifre ile aynı olamaz." });

            if (string.IsNullOrWhiteSpace(u.PasswordHash))
                return BadRequest(new { message = "Şifre altyapısı uygun değil (hash yok)." });

            // ✅ BCrypt doğrulama
            var ok = BCrypt.Net.BCrypt.Verify(cur, u.PasswordHash);
            if (!ok)
                return BadRequest(new { message = "Mevcut şifre yanlış." });

            // ✅ BCrypt ile yeni hash
            u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(nw);

            await _db.SaveChangesAsync();

            u.MustChangePassword = false;
            await _db.SaveChangesAsync();
            
            return Ok(new { message = "Şifre güncellendi." });
        }
    }
}
