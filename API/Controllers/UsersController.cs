// Controllers/UsersController.cs
using API.Data;
using API.Models;
using API.Realtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using API.Services;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<AnalysisHub> _hub;
    private readonly IEmailSender _email;

    public UsersController(AppDbContext db, IHubContext<AnalysisHub> hub, IEmailSender email)
    {
        _db = db;
        _hub = hub;
         _email = email;
    }

    /* ===================== Helpers ===================== */

    private static string NormEmail(string? s) => (s ?? "").Trim().ToLowerInvariant();
    private static string NormText(string? s) => (s ?? "").Trim();
    private static string NormRole(string? s) => (s ?? "user").Trim().ToLowerInvariant();

    // UsersController içinde (class seviyesinde) küçük DTO ekle:
    private sealed class ProjectMini
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
    }

    // ✅ educator eklendi (mevcut yapı bozulmadı)
    private static bool IsValidRole(string role) =>
        role is "admin" or "user" or "staff" or "trainer" or "educator";

    // ✅ Token/Claim içinden userId okumak için (farklı claim isimlerine tolerant)
    private int GetUserIdFromClaims()
    {
        var s =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("id");

        return int.TryParse(s, out var id) ? id : 0;
    }

    // UserId -> (primary ProjectId + join tablodaki projeler) birleşik döner
    private async Task<List<int>> GetUserProjectIds(int userId)
    {
        var primary = await _db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.ProjectId)
            .FirstOrDefaultAsync();

        var extra = await _db.UserProjects.AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.ProjectId)
            .ToListAsync();

        if (primary != null) extra.Add(primary.Value);
        return extra.Distinct().ToList();
    }

    // Body’den gelen ProjectId + ProjectIds’i normalize eder
    private static List<int> NormalizeProjectIds(int? projectId, int[]? projectIds)
    {
        var ids = new List<int>();
        if (projectIds != null) ids.AddRange(projectIds);
        if (projectId != null) ids.Add(projectId.Value);

        return ids.Where(x => x > 0).Distinct().ToList();
    }

    // Proje id’lerini doğrular (veritabanında var mı?)
    private async Task<(List<int> valid, bool hasInvalid)> ValidateProjectIdsAsync(List<int> ids)
    {
        if (ids.Count == 0) return (new List<int>(), false);

        var valid = await _db.Projects.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync();

        return (valid, valid.Count != ids.Count);
    }

    // Join tabloyu güncelle (sil-yaz)
    private async Task ReplaceUserProjectsAsync(int userId, List<int> projectIds, DateTimeOffset now)
    {
        var old = await _db.UserProjects.Where(x => x.UserId == userId).ToListAsync();
        if (old.Count > 0) _db.UserProjects.RemoveRange(old);

        foreach (var pid in projectIds.Distinct())
            _db.UserProjects.Add(new UserProject { UserId = userId, ProjectId = pid, CreatedAt = now });
    }

    // Kullanıcının projelerine bağlı eğitimlerin progress satırlarını aç (eksik olanları)
    private async Task EnsureTrainingProgressForProjectsAsync(int userId, List<int> projectIds, DateTimeOffset now)
    {
        if (projectIds.Count == 0) return;

        var trainingIds = await _db.TrainingAssignments.AsNoTracking()
            .Where(a => a.ProjectId != null && projectIds.Contains(a.ProjectId.Value))
            .Select(a => a.TrainingId)
            .Distinct()
            .ToListAsync();

        if (trainingIds.Count == 0) return;

        var existing = await _db.TrainingProgresses.AsNoTracking()
            .Where(tp => tp.UserId == userId && trainingIds.Contains(tp.TrainingId))
            .Select(tp => tp.TrainingId)
            .ToListAsync();

        var missing = trainingIds.Except(existing).ToList();
        foreach (var tid in missing)
        {
            _db.TrainingProgresses.Add(new TrainingProgress
            {
                UserId = userId,
                TrainingId = tid,
                Progress = 0,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
    }

    /* ===================== ADMIN: Bekleyen talepler ===================== */

    // GET /api/Users/admin-requests
    [HttpGet("admin-requests")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminRequests([FromQuery] string? search)
    {
        var q = _db.AccountRequests
            .Include(x => x.Project)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(x =>
                x.Email.ToLower().Contains(s) ||
                (x.Name + " " + x.Surname).ToLower().Contains(s));
        }

        var data = await q.OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                fullName = x.Name + " " + x.Surname,
                x.Email,
                x.Phone,
                x.Institution,
                x.BusinessAddress,
                createdAt = x.CreatedAt,

                // ✅ eski alanlar (bozulmasın)
                projectId = x.ProjectId,
                projectName = x.Project != null ? x.Project.Name : null,

                // ✅ yeni alanlar (frontend isterse kullanır)
                projectIds = x.ProjectId != null ? new[] { x.ProjectId.Value } : Array.Empty<int>()
            })
            .ToListAsync();

        return Ok(data);
    }

    // GET /api/Users/requests/count
    [HttpGet("requests/count")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> PendingCount()
    {
        var count = await _db.AccountRequests.CountAsync();
        return Ok(new { count });
    }

    /* ===================== ADMIN: Talep Onayla/Reddet ===================== */

    public sealed class ApproveBody
    {
        public int? ProjectId { get; set; }     // ✅ eski
        public int[]? ProjectIds { get; set; }  // ✅ yeni (çoklu)
    }

    // POST /api/Users/approve-request/{id}
    [HttpPost("approve-request/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ApproveRequest(int id, [FromBody] ApproveBody? body)
    {
        var r = await _db.AccountRequests.FirstOrDefaultAsync(x => x.Id == id);
        if (r is null) return NotFound();

        // ✅ normalize: body + request.ProjectId
        var ids = NormalizeProjectIds(body?.ProjectId, body?.ProjectIds);
        if (r.ProjectId != null) ids.Add(r.ProjectId.Value);
        ids = ids.Where(x => x > 0).Distinct().ToList();

        if (ids.Count == 0)
            return BadRequest(new { message = "Onaylamak için en az 1 proje seçilmelidir." });

        var (valid, hasInvalid) = await ValidateProjectIdsAsync(ids);
        if (hasInvalid)
            return BadRequest(new { message = "Seçilen projelerden bazıları geçersiz." });

        var emailLower = NormEmail(r.Email);
        var exists = await _db.Users.AnyAsync(u => u.Email.ToLower() == emailLower);
        if (exists) return Conflict(new { message = "Bu e-posta ile zaten bir kullanıcı var." });

        var now = DateTimeOffset.UtcNow;

        var user = new User
        {
            Name = r.Name,
            Surname = r.Surname,
            Email = emailLower,
            Phone = r.Phone ?? "",
            Institution = r.Institution ?? "",
            BusinessAddress = r.BusinessAddress ?? "",
            Role = "user",
            IsActive = true,

            // ✅ primary proje: ilk proje (eski sistem bozulmasın)
            ProjectId = valid[0],

            PasswordHash = r.PasswordHash,
            CreatedAt = now
        };

        _db.Users.Add(user);
        _db.AccountRequests.Remove(r);
        await _db.SaveChangesAsync();
        

        // ✅ join tablo
        foreach (var pid in valid)
            _db.UserProjects.Add(new UserProject { UserId = user.Id, ProjectId = pid, CreatedAt = now });

        // ✅ eğitim progress
        await EnsureTrainingProgressForProjectsAsync(user.Id, valid, now);

        await _db.SaveChangesAsync();

        // ✅ Hesap aktive maili (DB işlemleri başarılı olduktan sonra)
try
{
    var subject = "Eğitim Platformu - Hesabınız Aktifleştirildi";
    var htmlBody = $@"
        <div style=""font-family:Arial,sans-serif"">
          <h3>Hesabınız aktifleştirildi</h3>
          <p>Merhaba <b>{user.Name} {user.Surname}</b>,</p>
          <p>Hesap oluşturma talebiniz admin tarafından onaylandı ve hesabınız <b>aktif</b> hale getirildi.</p>
          <p>Artık sistemimize giriş yapabilirsiniz.</p>
          <hr />
          <p style=""color:#666;font-size:12px"">Bu e-posta otomatik gönderilmiştir.</p>
        </div>";

    await _email.SendAsync(user.Email, subject, htmlBody);
}
catch
{
    // ✅ Mail hatası olursa onayı geri alma: sistemi bozmayalım.
    // İstersen buraya log ekleyebilirsin.
}

        await _hub.Clients.All.SendAsync("analysisChanged");

        return Ok();
    }

    // POST /api/Users/reject-request/{id}
    [HttpPost("reject-request/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RejectRequest(int id)
    {
        var r = await _db.AccountRequests.FindAsync(id);
        if (r is null) return NotFound();
        _db.AccountRequests.Remove(r);
        await _db.SaveChangesAsync();
        return Ok();
    }

    /* ===================== ADMIN: Kullanıcı listesi ===================== */

    [HttpGet("admin-list")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminList([FromQuery] string? search, [FromQuery] string? role, [FromQuery] string? status)
    {
        var q = _db.Users
            .Include(x => x.Project) // eski primary proje
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            q = q.Where(x =>
                x.Email.ToLower().Contains(s) ||
                (x.Name + " " + x.Surname).ToLower().Contains(s));
        }

        if (!string.IsNullOrWhiteSpace(role))
            q = q.Where(x => x.Role == role);

        if (!string.IsNullOrWhiteSpace(status))
            q = status == "active" ? q.Where(x => x.IsActive) : q.Where(x => !x.IsActive);

        // 1) base users
        var baseUsers = await q.OrderBy(x => x.Email)
            .Select(x => new
            {
                x.Id,
                fullName = x.Name + " " + x.Surname,
                x.Email,
                x.Phone,
                x.Institution,
                x.BusinessAddress,
                createdAt = x.CreatedAt,
                x.Role,
                x.IsActive,

                // eski alanlar
                primaryProjectId = x.ProjectId,
                primaryProjectName = x.Project != null ? x.Project.Name : null
            })
            .ToListAsync();

        var userIds = baseUsers.Select(x => x.Id).ToList();

        // 2) user-project join (çoklu)
        var links = await (
            from up in _db.UserProjects.AsNoTracking()
            join p in _db.Projects.AsNoTracking() on up.ProjectId equals p.Id
            where userIds.Contains(up.UserId)
            select new { up.UserId, ProjectId = p.Id, ProjectName = p.Name }
        ).ToListAsync();

        // 3) dictionary: userId -> List<ProjectMini>
        var grouped = links
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .GroupBy(z => z.ProjectId)
                    .Select(zz => new ProjectMini
                    {
                        Id = zz.Key,
                        Name = zz.First().ProjectName
                    })
                    .ToList()
            );

        // 4) response
        var data = baseUsers.Select(u =>
        {
            grouped.TryGetValue(u.Id, out var list);
            list ??= new List<ProjectMini>();

            // primary proje join'de yoksa ekle (edge-case)
            if (u.primaryProjectId != null && u.primaryProjectName != null)
            {
                var pid = u.primaryProjectId.Value;
                if (!list.Any(x => x.Id == pid))
                    list.Add(new ProjectMini { Id = pid, Name = u.primaryProjectName });
            }

            var projectIds = list.Select(x => x.Id).Distinct().ToList();

            return new
            {
                u.Id,
                u.fullName,
                u.Email,
                u.Phone,
                u.Institution,
                u.BusinessAddress,
                u.createdAt,
                u.Role,
                u.IsActive,

                projectName = u.primaryProjectName,

                projectIds,
                projects = list.Select(x => new { id = x.Id, name = x.Name }).ToList()
            };
        }).ToList();

        return Ok(data);
    }

    /* ===================== ADMIN: Kullanıcı aktif/pasif + sil ===================== */

    [HttpPatch("{id:int}/toggle-active")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var u = await _db.Users.FindAsync(id);
        if (u is null) return NotFound();
        u.IsActive = !u.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { u.IsActive });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var u = await _db.Users.FindAsync(id);
        if (u is null) return NotFound();

        var ups = await _db.UserProjects.Where(x => x.UserId == id).ToListAsync();
        if (ups.Count > 0) _db.UserProjects.RemoveRange(ups);

        _db.Users.Remove(u);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ===================== ADMIN: Kullanıcı güncelle ===================== */

    public sealed class AdminUpdateBody
    {
        public string Name { get; set; } = "";
        public string Surname { get; set; } = "";
        public string? Phone { get; set; }
        public string? Institution { get; set; }
        public string? BusinessAddress { get; set; }
        public string Role { get; set; } = "user"; // admin/user/staff/trainer/educator

        public string? Password { get; set; }

        public int? ProjectId { get; set; }
        public int[]? ProjectIds { get; set; }
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] AdminUpdateBody body)
    {
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == id);
        if (u is null) return NotFound(new { message = "Kullanıcı bulunamadı." });

        var role = NormRole(body.Role);
        if (!IsValidRole(role))
            return BadRequest(new { message = "Geçersiz rol." });

        var ids = NormalizeProjectIds(body.ProjectId, body.ProjectIds);
        var (valid, hasInvalid) = await ValidateProjectIdsAsync(ids);
        if (hasInvalid)
            return BadRequest(new { message = "Seçilen projelerden bazıları geçersiz." });

        u.Name = NormText(body.Name) == "" ? u.Name : NormText(body.Name);
        u.Surname = NormText(body.Surname) == "" ? u.Surname : NormText(body.Surname);
        u.Phone = body.Phone ?? "";
        u.Institution = body.Institution ?? "";
        u.BusinessAddress = body.BusinessAddress ?? "";
        u.Role = role;

        u.ProjectId = valid.Count > 0 ? valid[0] : null;

        var now = DateTimeOffset.UtcNow;

        await ReplaceUserProjectsAsync(u.Id, valid, now);
        await EnsureTrainingProgressForProjectsAsync(u.Id, valid, now);

        var pw = (body.Password ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(pw))
        {
            if (pw.Length < 6)
                return BadRequest(new { message = "Parola en az 6 karakter olmalı." });

            u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(pw);
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    /* ===================== ADMIN: Direkt kullanıcı oluştur ===================== */

    public sealed class AdminCreateBody
    {
        public string Name { get; set; } = "";
        public string Surname { get; set; } = "";
        public string Email { get; set; } = "";
        public string? Phone { get; set; }
        public string? Institution { get; set; }
        public string? BusinessAddress { get; set; }
        public string Role { get; set; } = "user"; // admin/user/staff/trainer/educator
        public string Password { get; set; } = "";

        public int? ProjectId { get; set; }
        public int[]? ProjectIds { get; set; }
    }

    [HttpPost("admin-create")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdminCreate([FromBody] AdminCreateBody body)
    {
        var email = NormEmail(body.Email);
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "E-posta zorunlu." });

        var pw = (body.Password ?? "").Trim();
        if (string.IsNullOrWhiteSpace(pw) || pw.Length < 6)
            return BadRequest(new { message = "Parola en az 6 karakter olmalı." });

        var name = NormText(body.Name);
        var surname = NormText(body.Surname);
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(surname))
            return BadRequest(new { message = "Ad ve soyad zorunlu." });

        var existsUser = await _db.Users.AnyAsync(x => x.Email.ToLower() == email);
        var existsReq = await _db.AccountRequests.AnyAsync(x => x.Email.ToLower() == email);
        if (existsUser || existsReq)
            return Conflict(new { message = "Bu e-posta kullanımda." });

        var role = NormRole(body.Role);
        if (!IsValidRole(role))
            return BadRequest(new { message = "Geçersiz rol." });

        var ids = NormalizeProjectIds(body.ProjectId, body.ProjectIds);
        var (valid, hasInvalid) = await ValidateProjectIdsAsync(ids);
        if (hasInvalid)
            return BadRequest(new { message = "Seçilen projelerden bazıları geçersiz." });

        var now = DateTimeOffset.UtcNow;
        var hash = BCrypt.Net.BCrypt.HashPassword(pw);

        var user = new User
        {
            Name = name,
            Surname = surname,
            Email = email,
            Phone = body.Phone ?? "",
            Institution = body.Institution ?? "",
            BusinessAddress = body.BusinessAddress ?? "",
            Role = role,
            IsActive = true,
            ProjectId = valid.Count > 0 ? valid[0] : null,
            PasswordHash = hash,
            CreatedAt = now,
            MustChangePassword = true // ✅ ilk girişte zorunlu
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        foreach (var pid in valid)
            _db.UserProjects.Add(new UserProject { UserId = user.Id, ProjectId = pid, CreatedAt = now });

        await EnsureTrainingProgressForProjectsAsync(user.Id, valid, now);

        await _db.SaveChangesAsync();
        await _hub.Clients.All.SendAsync("analysisChanged");

        return Ok(new { id = user.Id });
    }

    /* ===================== Projeler ===================== */

    // ✅ Mevcut yapıyı bozmadan: admin aynı, educator/trainer sadece kendi projeleri
    [HttpGet("projects")]
    [Authorize(Roles = "admin,educator,trainer")]
    public async Task<IActionResult> Projects()
    {
        if (User.IsInRole("admin"))
        {
            return Ok(await _db.Projects.AsNoTracking().OrderBy(x => x.Name).ToListAsync());
        }

        var userId = GetUserIdFromClaims();
        if (userId <= 0) return Forbid();

        var ids = await GetUserProjectIds(userId);
        if (ids.Count == 0) return Ok(new List<Project>());

        var data = await _db.Projects.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(data);
    }

    public sealed class ProjectBody { public string Name { get; set; } = ""; }

    [HttpPost("projects")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateProject([FromBody] ProjectBody body)
    {
        var name = NormText(body.Name);
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Proje adı zorunlu." });

        if (await _db.Projects.AnyAsync(x => x.Name.ToLower() == name.ToLower()))
            return Conflict(new { message = "Proje adı kullanımda." });

        _db.Projects.Add(new Project { Name = name });
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("projects/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteProject(int id)
    {
        var p = await _db.Projects.FindAsync(id);
        if (p is null) return NotFound();
        _db.Projects.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /* ===================== Kurumlar ===================== */

    [HttpGet("institutions")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Institutions()
    {
        var data = await _db.Institutions.AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Name })
            .ToListAsync();

        return Ok(data);
    }

    public sealed class InstitutionBody { public string Name { get; set; } = ""; }

    [HttpPost("institutions")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> CreateInstitution([FromBody] InstitutionBody body)
    {
        var name = NormText(body.Name);
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Kurum adı zorunlu." });

        var exists = await _db.Institutions.AnyAsync(x => x.Name.ToLower() == name.ToLower());
        if (exists)
            return Conflict(new { message = "Bu kurum zaten var." });

        _db.Institutions.Add(new Institution { Name = name });
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("institutions/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteInstitution(int id)
    {
        var k = await _db.Institutions.FindAsync(id);
        if (k is null) return NotFound(new { message = "Kurum bulunamadı." });

        _db.Institutions.Remove(k);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
