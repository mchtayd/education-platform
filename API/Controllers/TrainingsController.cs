// API/Controllers/TrainingsController.cs
using API.Data;
using API.Models;
using API.Realtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TrainingsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly IHubContext<AnalysisHub> _hub;

        public TrainingsController(AppDbContext db, IWebHostEnvironment env, IHubContext<AnalysisHub> hub)
        {
            _db = db;
            _env = env;
            _hub = hub;
        }

        // ✅ "date" alanını UTC gün formatına çevir
        private static DateTime DateTimeUtc(DateTime d) =>
            DateTime.SpecifyKind(d.Date, DateTimeKind.Utc);

        // ✅ Yayından kaldırma: seçilen günün 23:59:59.9999999 (UTC)
        private static DateTimeOffset? NormalizeUnpublishAt(DateTime? unpublishDate)
        {
            if (!unpublishDate.HasValue) return null;

            var endUtc = DateTime.SpecifyKind(
                unpublishDate.Value.Date.AddDays(1).AddTicks(-1),
                DateTimeKind.Utc
            );

            return new DateTimeOffset(endUtc);
        }

        // ============== LIST & DETAIL ==============

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> List(
            [FromQuery] string? search,
            [FromQuery] int? categoryId,
            [FromQuery] string? type,
            [FromQuery] int? projectId
        )
        {
            var q = _db.Trainings
                .Include(t => t.Category)
                .Include(t => t.Project)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
                q = q.Where(t => t.Title.ToLower().Contains(search.ToLower()));

            if (categoryId.HasValue)
                q = q.Where(t => t.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(type))
                q = q.Where(t => t.ContentType == type);

            if (projectId.HasValue)
                q = q.Where(t => t.ProjectId == projectId.Value);

            var data = await q
                .OrderByDescending(t => t.Date)
                .Select(t => new
                {
                    t.Id,
                    t.CategoryId,
                    CategoryName = t.Category.Name,
                    t.Title,
                    t.ContentType,
                    Date = t.Date.ToString("yyyy-MM-dd"),
                    t.FileUrl,
                    t.PublisherEmail,
                    t.ProjectId,
                    ProjectName = t.Project != null ? t.Project.Name : null
                })
                .ToListAsync();

            return Ok(data);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var t = await _db.Trainings
                .Include(x => x.Category)
                .Include(x => x.Project)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (t is null) return NotFound();

            return Ok(new
            {
                t.Id,
                t.CategoryId,
                CategoryName = t.Category.Name,
                t.Title,
                t.ContentType,
                Date = t.Date.ToString("yyyy-MM-dd"),
                t.FileUrl,
                t.PublisherEmail,
                t.ProjectId,
                ProjectName = t.Project != null ? t.Project.Name : null
            });
        }

        // ============== CREATE / UPDATE / DELETE ==============

        [HttpPost]
        [Authorize(Roles = "admin,trainer,educator")]
        [RequestSizeLimit(1024L * 1024 * 500)] // 500MB
        public async Task<IActionResult> Create(
            [FromForm] int categoryId,
            [FromForm] string title,
            [FromForm] string contentType,
            [FromForm] DateTime date,
            [FromForm] IFormFile file,
            [FromForm] string? publisherEmail,
            [FromForm] int? projectId
        )
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Dosya zorunlu." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (contentType == "PDF" && ext != ".pdf")
                return BadRequest(new { message = "PDF bekleniyor." });
            if (contentType == "Video" && !new[] { ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi" }.Contains(ext))
                return BadRequest(new { message = "Video dosyası bekleniyor." });

            var root = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "trainings");
            Directory.CreateDirectory(root);

            var fn = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(root, fn);
            using (var fs = System.IO.File.Create(fullPath))
                await file.CopyToAsync(fs);

            var url = $"/uploads/trainings/{fn}";

            var t = new Training
            {
                CategoryId = categoryId,
                Title = title.Trim(),
                ContentType = contentType,
                Date = DateTimeUtc(date), // ✅ HATA DÜZELTİLDİ
                FileUrl = url,
                PublisherEmail = string.IsNullOrWhiteSpace(publisherEmail) ? "-" : publisherEmail,
                ProjectId = projectId
            };

            _db.Trainings.Add(t);
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = t.Id }, new { t.Id });
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> Update(
            int id,
            [FromForm] int categoryId,
            [FromForm] string title,
            [FromForm] string contentType,
            [FromForm] DateTime date,
            [FromForm] IFormFile? file,
            [FromForm] int? projectId
        )
        {
            var t = await _db.Trainings.FindAsync(id);
            if (t is null) return NotFound();

            t.CategoryId = categoryId;
            t.Title = title.Trim();
            t.ContentType = contentType;
            t.Date = DateTimeUtc(date); // ✅ HATA DÜZELTİLDİ (DateTimetimeUtc değil)
            t.ProjectId = projectId;

            if (file is not null && file.Length > 0)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (contentType == "PDF" && ext != ".pdf")
                    return BadRequest(new { message = "PDF bekleniyor." });
                if (contentType == "Video" && !new[] { ".mp4", ".webm", ".mov", ".mkv" }.Contains(ext))
                    return BadRequest(new { message = "Video dosyası bekleniyor." });

                var root = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "trainings");
                Directory.CreateDirectory(root);

                var fn = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(root, fn);
                using (var fs = System.IO.File.Create(fullPath))
                    await file.CopyToAsync(fs);

                t.FileUrl = $"/uploads/trainings/{fn}";
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = "Güncellendi" });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> Delete(int id)
        {
            var t = await _db.Trainings.FindAsync(id);
            if (t is null) return NotFound();

            _db.Trainings.Remove(t);
            await _db.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("analysisChanged");
            return NoContent();
        }

        // ============== ASSIGNMENT HELPER DATA ==============

        [HttpGet("assign-data")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> AssignData()
        {
            var trainings = await _db.Trainings
                .OrderBy(x => x.Title)
                .Select(x => new { x.Id, title = x.Title, x.ProjectId })
                .ToListAsync();

            var users = await _db.Users
                .OrderBy(x => x.Email)
                .Select(x => new
                {
                    x.Id,
                    fullName = x.Name + " " + x.Surname,
                    x.Email,
                    x.ProjectId,
                    projectName = x.Project != null ? x.Project.Name : null
                })
                .ToListAsync();

            var projects = await _db.Projects
                .OrderBy(x => x.Name)
                .Select(x => new { x.Id, x.Name })
                .ToListAsync();

            return Ok(new { trainings, users, projects });
        }

        // ============== ASSIGN TO USERS ==============

        // ✅ unpublishDate eklendi (opsiyonel)
        public sealed record AssignToUsersDto(int[] TrainingIds, int[] UserIds, DateTime? UnpublishDate);

        [HttpPost("assign-to-users")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> AssignToUsers([FromBody] AssignToUsersDto dto)
        {
            if (dto.TrainingIds == null || dto.UserIds == null ||
                dto.TrainingIds.Length == 0 || dto.UserIds.Length == 0)
                return BadRequest(new { message = "Eğitim ve kullanıcı seçmelisiniz." });

            var now = DateTimeOffset.UtcNow;
            var unpublishAt = NormalizeUnpublishAt(dto.UnpublishDate); // ✅

            var validT = await _db.Trainings.Where(t => dto.TrainingIds.Contains(t.Id)).Select(t => t.Id).ToListAsync();
            var missT = dto.TrainingIds.Except(validT).ToArray();
            if (missT.Length > 0) return BadRequest(new { message = $"Geçersiz eğitim ID: {string.Join(", ", missT)}" });

            var validU = await _db.Users.Where(u => dto.UserIds.Contains(u.Id)).Select(u => u.Id).ToListAsync();
            var missU = dto.UserIds.Except(validU).ToArray();
            if (missU.Length > 0) return BadRequest(new { message = $"Geçersiz kullanıcı ID: {string.Join(", ", missU)}" });

            var tIds = dto.TrainingIds.Distinct().ToArray();
            var uIds = dto.UserIds.Distinct().ToArray();

            var existing = await _db.TrainingAssignments
                .Where(x => tIds.Contains(x.TrainingId) && x.UserId != null && uIds.Contains(x.UserId.Value))
                .Select(x => new { x.TrainingId, x.UserId })
                .ToListAsync();

            var exists = new HashSet<(int t, int u)>(existing.Select(e => (e.TrainingId, e.UserId!.Value)));

            foreach (var t in tIds)
                foreach (var u in uIds)
                    if (!exists.Contains((t, u)))
                        _db.TrainingAssignments.Add(new TrainingAssignment
                        {
                            TrainingId = t,
                            UserId = u,
                            ProjectId = null,
                            CreatedAt = now,
                            UnpublishAt = unpublishAt // ✅
                        });

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg)
            {
                return pg.SqlState switch
                {
                    "23505" => Conflict(new { message = "Seçilen öğelerden bazıları zaten bu kullanıcı(lar)a atanmış." }),
                    "23514" => BadRequest(new { message = "Hedef alanı hatalı: UserId veya ProjectId'den yalnızca biri dolu olmalı." }),
                    "23503" => BadRequest(new { message = "Yabancı anahtar hatası: Eğitim veya kullanıcı bulunamadı." }),
                    _ => StatusCode(500, new { message = "Atama kaydedilirken veritabanı hatası oluştu.", detail = pg.MessageText })
                };
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Atama kaydedilirken beklenmeyen bir hata oluştu.", detail = ex.GetBaseException().Message });
            }

            foreach (var tid in tIds)
                await EnsureProgressForUsersAsync(tid, uIds, now);

            await _hub.Clients.All.SendAsync("analysisChanged");
            return Ok();
        }

        // ============== ASSIGN TO PROJECT ==============

        // ✅ unpublishDate eklendi (opsiyonel)
        public sealed record AssignToProjectDto(int[] TrainingIds, int ProjectId, DateTime? UnpublishDate);

        [HttpPost("assign-to-project")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> AssignToProject([FromBody] AssignToProjectDto dto)
        {
            if (dto.TrainingIds.Length == 0) return BadRequest();

            var now = DateTimeOffset.UtcNow;
            var unpublishAt = NormalizeUnpublishAt(dto.UnpublishDate); // ✅

            var existing = await _db.TrainingAssignments
                .Where(x => dto.TrainingIds.Contains(x.TrainingId) && x.ProjectId == dto.ProjectId)
                .Select(x => x.TrainingId)
                .ToListAsync();

            var existingSet = new HashSet<int>(existing);

            foreach (var t in dto.TrainingIds.Distinct())
            {
                if (!existingSet.Contains(t))
                {
                    _db.TrainingAssignments.Add(new TrainingAssignment
                    {
                        TrainingId = t,
                        ProjectId = dto.ProjectId,
                        UserId = null,
                        CreatedAt = now,
                        UnpublishAt = unpublishAt // ✅
                    });
                }
            }

            await _db.SaveChangesAsync();

            var projectUserIds = await _db.Users
                .Where(u => u.ProjectId == dto.ProjectId)
                .Select(u => u.Id)
                .ToListAsync();

            foreach (var tid in dto.TrainingIds.Distinct())
                await EnsureProgressForUsersAsync(tid, projectUserIds, now);

            await _hub.Clients.All.SendAsync("analysisChanged");
            return Ok();
        }

        // ============== LIST / DELETE ASSIGNMENTS ==============

        [HttpGet("assignments")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> Assignments([FromQuery] string? search)
        {
            var q = _db.TrainingAssignments
                .Include(x => x.Training)
                .Include(x => x.User)
                .Include(x => x.Project)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                q = q.Where(x =>
                    x.Training.Title.ToLower().Contains(s) ||
                    (x.User != null && ((x.User.Name + " " + x.User.Surname).ToLower().Contains(s) || x.User.Email.ToLower().Contains(s))) ||
                    (x.Project != null && x.Project.Name.ToLower().Contains(s)));
            }

            var data = await q
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    x.Id,
                    createdAt = x.CreatedAt,
                    trainingId = x.TrainingId,
                    trainingTitle = x.Training.Title,
                    kind = x.UserId != null ? "user" : "project",
                    targetId = x.UserId ?? x.ProjectId,
                    targetName = x.UserId != null
                        ? (x.User!.Name + " " + x.User!.Surname + " (" + x.User!.Email + ")")
                        : x.Project!.Name,
                    unpublishAt = x.UnpublishAt // ✅
                })
                .ToListAsync();

            return Ok(data);
        }

        [HttpDelete("assignments/{id:int}")]
        [Authorize(Roles = "admin,trainer,educator")]
        public async Task<IActionResult> DeleteAssignment(int id)
        {
            var a = await _db.TrainingAssignments.FindAsync(id);
            if (a is null) return NotFound();

            _db.TrainingAssignments.Remove(a);
            await _db.SaveChangesAsync();

            await _hub.Clients.All.SendAsync("analysisChanged");
            return NoContent();
        }

        // ============== HELPERS ==============

        private async Task<int> EnsureProgressForUsersAsync(int trainingId, IEnumerable<int> userIds, DateTimeOffset now)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0) return 0;

            var existing = await _db.TrainingProgresses
                .Where(p => p.TrainingId == trainingId && ids.Contains(p.UserId))
                .Select(p => p.UserId)
                .ToListAsync();

            var toCreate = ids.Except(existing).ToList();
            foreach (var uid in toCreate)
            {
                _db.TrainingProgresses.Add(new TrainingProgress
                {
                    UserId = uid,
                    TrainingId = trainingId,
                    Progress = 0,
                    Rating = null,
                    Comment = null,
                    CreatedAt = now,
                    UpdatedAt = now,
                    LastViewedAt = null,
                    CompletedAt = null
                });
            }

            if (toCreate.Count > 0)
                await _db.SaveChangesAsync();

            return toCreate.Count;
        }
    }
}
