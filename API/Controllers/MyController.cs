//MyController.cs
using System.Security.Claims;
using API.Data;
using API.Models;
using API.Realtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // kullanıcı girişi şart
    public class MyController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IHubContext<AnalysisHub> _hub;

        public MyController(AppDbContext db, IHubContext<AnalysisHub> hub)
        { _db = db; _hub = hub; }

        private int CurrentUserId =>
            int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue(ClaimTypes.Name)
                     ?? throw new InvalidOperationException("User id claim not found"));

        // ---- Kategoriler: sadece bana atanmış eğitimlerin kategorileri
        // GET /api/My/categories
        [HttpGet("categories")]
        public async Task<IActionResult> Categories()
        {
            var uid = CurrentUserId;

            // Bana atanmış eğitimler (doğrudan + proje)
            var assignedTrainingIds =
                (
                    from a in _db.TrainingAssignments where a.UserId == uid select a.TrainingId
                )
                .Concat(
                    from a in _db.TrainingAssignments
                    join u in _db.Users on a.ProjectId equals u.ProjectId
                    where u.Id == uid && a.ProjectId != null
                    select a.TrainingId
                )
                .Distinct();

            var q =
                from t in _db.Trainings.AsNoTracking()
                join c in _db.TrainingCategories.AsNoTracking() on t.CategoryId equals c.Id
                where assignedTrainingIds.Contains(t.Id)
                select new { c.Id, c.Name, TrainingId = t.Id };

            var groups = await q.GroupBy(x => new { x.Id, x.Name })
                .Select(g => new
                {
                    id = g.Key.Id,
                    name = g.Key.Name,
                    count = g.Count(),
                    watched = _db.TrainingProgresses.Count(p => p.UserId == uid && g.Select(x => x.TrainingId).Contains(p.TrainingId) && p.Progress >= 100)
                }).OrderBy(x => x.name).ToListAsync();

            return Ok(groups);
        }

        // ---- Bir kategori altındaki eğitimler + benim ilerlemem
        // GET /api/My/trainings?categoryId=1&search=
        [HttpGet("trainings")]
        public async Task<IActionResult> Trainings([FromQuery] int categoryId, [FromQuery] string? search)
        {
            var uid = CurrentUserId;

            // Bana atanmış eğitim id’leri
            var assignedTrainingIds =
                (
                    from a in _db.TrainingAssignments where a.UserId == uid select a.TrainingId
                )
                .Concat(
                    from a in _db.TrainingAssignments
                    join u in _db.Users on a.ProjectId equals u.ProjectId
                    where u.Id == uid && a.ProjectId != null
                    select a.TrainingId
                )
                .Distinct();

            var trainings = _db.Trainings.AsNoTracking()
                .Where(t => t.CategoryId == categoryId && assignedTrainingIds.Contains(t.Id));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                trainings = trainings.Where(t => t.Title.ToLower().Contains(s));
            }

            var list =
                await (from t in trainings
                       join c in _db.TrainingCategories on t.CategoryId equals c.Id
                       join p in _db.TrainingProgresses.Where(x => x.UserId == uid) on t.Id equals p.TrainingId into gj
                       from pr in gj.DefaultIfEmpty()
                       orderby t.Date descending, t.Title
                       select new
                       {
                           id = t.Id,
                           title = t.Title,
                           categoryId = c.Id,
                           categoryName = c.Name,
                           contentType = t.ContentType,
                           date = t.Date,
                           fileUrl = t.FileUrl,
                           // görsel önizleme için şimdilik dosyanın kendisi/placeholder kullanacağız
                           thumbUrl = t.FileUrl,
                           progress = pr != null ? pr.Progress : 0,
                           watched = pr != null && pr.Progress >= 100,
                           lastViewedAt = pr != null ? pr.LastViewedAt : null,
                           rating = pr != null ? pr.Rating : null,
                           comment = pr != null ? pr.Comment : null
                       }).ToListAsync();

            return Ok(list);
        }

        // ---- İlerleme güncelle (varsayılan 100 = izlendi)
        // POST /api/My/progress/view/{trainingId}
        public sealed record ViewDto(int? progress);
        [HttpPost("progress/view/{trainingId:int}")]
        public async Task<IActionResult> View(int trainingId, [FromBody] ViewDto dto)
        {
            var uid = CurrentUserId;
            var now = DateTimeOffset.UtcNow;

            var pr = await _db.TrainingProgresses.FirstOrDefaultAsync(p => p.UserId == uid && p.TrainingId == trainingId);
            if (pr is null)
            {
                pr = new TrainingProgress { UserId = uid, TrainingId = trainingId, Progress = 0, CreatedAt = now, UpdatedAt = now };
                _db.TrainingProgresses.Add(pr);
            }

            var newProgress = Math.Clamp(dto?.progress ?? 100, 0, 100);
            pr.Progress = newProgress;
            pr.LastViewedAt = now;
            pr.UpdatedAt = now;
            if (newProgress >= 100 && pr.CompletedAt is null) pr.CompletedAt = now;

            await _db.SaveChangesAsync();

            // Analiz sayfalarını tetikle
            await _hub.Clients.All.SendAsync("analysisChanged");
            return Ok(new { pr.Progress });
        }

        // ---- Puan / Yorum
        // POST /api/My/progress/feedback/{trainingId}
        public sealed record FeedbackDto(int rating, string? comment);
        [HttpPost("progress/feedback/{trainingId:int}")]
        public async Task<IActionResult> Feedback(int trainingId, [FromBody] FeedbackDto dto)
        {
            var uid = CurrentUserId;
            var now = DateTimeOffset.UtcNow;

            var pr = await _db.TrainingProgresses.FirstOrDefaultAsync(p => p.UserId == uid && p.TrainingId == trainingId);
            if (pr is null)
            {
                pr = new TrainingProgress { UserId = uid, TrainingId = trainingId, CreatedAt = now };
                _db.TrainingProgresses.Add(pr);
            }

            pr.Rating = Math.Clamp(dto.rating, 1, 5);
            pr.Comment = string.IsNullOrWhiteSpace(dto.comment) ? null : dto.comment!.Trim();
            pr.UpdatedAt = now;

            await _db.SaveChangesAsync();
            await _hub.Clients.All.SendAsync("analysisChanged");
            return Ok();
        }
    }
}
