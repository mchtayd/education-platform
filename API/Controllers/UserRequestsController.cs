//UserRequestsController.cs
using API.Data;
using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserRequestsController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserRequestsController(AppDbContext db) => _db = db;

    // Admin: talepleri listele
    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> List([FromQuery] string? search)
    {
        var q = _db.UserRequests.Include(x => x.Project).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(x =>
                x.Email.ToLower().Contains(s) ||
                ((x.Name ?? "") + " " + (x.Surname ?? "")).ToLower().Contains(s));
        }

        var data = await q
            .OrderByDescending(x => x.CreatedAt)  // <— RequestedAt değil CreatedAt
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Surname,
                x.Email,
                x.Phone,
                x.Institution,
                x.BusinessAddress,
                x.ProjectId,
                ProjectName = x.Project != null ? x.Project.Name : null,
                createdAt = x.CreatedAt
            })
            .ToListAsync();

        return Ok(data);
    }

    // Public: yeni talep oluştur
    public sealed class UserRequestDto
    {
        public string Email { get; set; } = null!;
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Phone { get; set; }
        public string? Institution { get; set; }
        public string? BusinessAddress { get; set; }
        public int? ProjectId { get; set; }
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Create([FromBody] UserRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "Eksik bilgi" });

        var email = dto.Email.Trim().ToLower();

        var emailKullanimda = await _db.Users.AnyAsync(u => u.Email.ToLower() == email) ||
                              await _db.UserRequests.AnyAsync(r => r.Email.ToLower() == email);

        if (emailKullanimda)
            return Conflict(new { message = "Bu e-posta zaten kullanımda." });

        var req = new UserRequest
        {
            Email = dto.Email.Trim(),
            Name = dto.Name?.Trim(),
            Surname = dto.Surname?.Trim(),
            Phone = dto.Phone?.Trim(),
            Institution = dto.Institution?.Trim(),
            BusinessAddress = dto.BusinessAddress?.Trim(),
            ProjectId = dto.ProjectId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.UserRequests.Add(req);
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "Hesap oluşturma talebiniz başarıyla iletildi."
        });
    }
}
