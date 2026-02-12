//Controllers/AnalysisController.cs
using API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "admin")]
    public class AnalysisController : ControllerBase
    {
        private readonly AppDbContext _db;
        public AnalysisController(AppDbContext db) => _db = db;

        // ------------------------------------------------------------
        // LOOKUPS (Filtre dropdownları için)
        // GET /api/Analysis/lookups
        // ------------------------------------------------------------
        [HttpGet("lookups")]
        public async Task<IActionResult> Lookups()
        {
            var projects = await _db.Projects.AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new { id = x.Id, name = x.Name })
                .ToListAsync();

            var trainings = await _db.Trainings.AsNoTracking()
                .OrderByDescending(x => x.Date)
                .ThenBy(x => x.Title)
                .Select(x => new { id = x.Id, title = x.Title })
                .ToListAsync();

            return Ok(new { projects, trainings });
        }

        // ------------------------------------------------------------
        // TAB-1: Kullanıcılara tanımlanan eğitimler + ilerleme
        // GET /api/Analysis/assignments?search=&projectId=&trainingId=&status=
        // status: all | notstarted | inprogress | completed
        // ------------------------------------------------------------
        [HttpGet("assignments")]
        public async Task<IActionResult> Assignments(
            [FromQuery] string? search,
            [FromQuery] int? projectId,
            [FromQuery] int? trainingId,
            [FromQuery] string? status // all, notstarted, inprogress, completed
        )
        {
            // 1) Doğrudan kullanıcı atamaları
            var directPairs =
                from a in _db.TrainingAssignments.AsNoTracking()
                where a.UserId != null
                select new
                {
                    a.TrainingId,
                    UserId = a.UserId!.Value,
                    AssignedAt = a.CreatedAt
                };

            // 2) Projeye atama -> o projedeki tüm kullanıcılar
            var projectPairs =
                from a in _db.TrainingAssignments.AsNoTracking()
                where a.ProjectId != null
                join u in _db.Users.AsNoTracking() on a.ProjectId equals u.ProjectId
                select new
                {
                    a.TrainingId,
                    UserId = u.Id,
                    AssignedAt = a.CreatedAt
                };

            // 3) Birleşim + duplicate engelle (aynı user-training birden fazla atandıysa tekle)
            var pairs =
                from p in directPairs.Concat(projectPairs)
                group p by new { p.UserId, p.TrainingId } into g
                select new
                {
                    g.Key.UserId,
                    g.Key.TrainingId,
                    AssignedAt = g.Min(x => x.AssignedAt)
                };

            // 4) Join: users + trainings + categories + projects + progresses
            var query =
                from p in pairs
                join u in _db.Users.AsNoTracking() on p.UserId equals u.Id
                where u.Role != "admin" // ✅ admin hariç
                join t in _db.Trainings.AsNoTracking() on p.TrainingId equals t.Id
                join c in _db.TrainingCategories.AsNoTracking() on t.CategoryId equals c.Id
                join prj in _db.Projects.AsNoTracking() on u.ProjectId equals prj.Id into gprj
                from prj in gprj.DefaultIfEmpty()
                join pr in _db.TrainingProgresses.AsNoTracking()
                    on new { UserId = p.UserId, TrainingId = p.TrainingId }
                    equals new { pr.UserId, pr.TrainingId } into gpr
                from pr in gpr.DefaultIfEmpty()
                select new
                {
                    userId = u.Id,
                    fullName = u.Name + " " + u.Surname,
                    email = u.Email,
                    projectId = u.ProjectId,
                    projectName = prj != null ? prj.Name : null,

                    trainingId = t.Id,
                    trainingTitle = t.Title,
                    categoryName = c.Name,
                    contentType = t.ContentType,
                    trainingDate = t.Date,

                    assignedAt = p.AssignedAt,

                    progress = pr != null ? pr.Progress : 0,
                    lastViewedAt = pr != null ? pr.LastViewedAt : null,
                    updatedAt = pr != null ? (DateTimeOffset?)pr.UpdatedAt : null,
                };

            // filters
            if (projectId.HasValue)
                query = query.Where(x => x.projectId == projectId.Value);

            if (trainingId.HasValue)
                query = query.Where(x => x.trainingId == trainingId.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(x =>
                    x.email.ToLower().Contains(s) ||
                    x.fullName.ToLower().Contains(s) ||
                    x.trainingTitle.ToLower().Contains(s) ||
                    x.categoryName.ToLower().Contains(s));
            }

            var st = (status ?? "all").Trim().ToLower();
            if (st == "notstarted")
                query = query.Where(x => x.progress <= 0);
            else if (st == "inprogress")
                query = query.Where(x => x.progress > 0 && x.progress < 100);
            else if (st == "completed")
                query = query.Where(x => x.progress >= 100);

            var data = await query
                .OrderByDescending(x => x.assignedAt)
                .ThenBy(x => x.fullName)
                .ThenBy(x => x.trainingTitle)
                .ToListAsync();

            return Ok(data);
        }

        // ------------------------------------------------------------
        // TAB-2: Yorumlar / puanlar analizi
        // GET /api/Analysis/feedback?search=&projectId=&trainingId=&onlyCommented=&onlyRated=
        // ------------------------------------------------------------
        [HttpGet("feedback")]
        public async Task<IActionResult> Feedback(
            [FromQuery] string? search,
            [FromQuery] int? projectId,
            [FromQuery] int? trainingId,
            [FromQuery] bool? onlyCommented,
            [FromQuery] bool? onlyRated
        )
        {
            var q =
                from pr in _db.TrainingProgresses.AsNoTracking()
                join u in _db.Users.AsNoTracking() on pr.UserId equals u.Id
                where u.Role != "admin" // ✅ admin hariç
                join t in _db.Trainings.AsNoTracking() on pr.TrainingId equals t.Id
                join c in _db.TrainingCategories.AsNoTracking() on t.CategoryId equals c.Id
                join pj in _db.Projects.AsNoTracking() on u.ProjectId equals pj.Id into gpj
                from pj in gpj.DefaultIfEmpty()
                select new
                {
                    id = pr.Id,
                    userId = u.Id,
                    fullName = u.Name + " " + u.Surname,
                    email = u.Email,
                    projectId = u.ProjectId,
                    projectName = pj != null ? pj.Name : null,

                    trainingId = t.Id,
                    trainingTitle = t.Title,
                    categoryName = c.Name,
                    contentType = t.ContentType,

                    progress = pr.Progress,
                    lastViewedAt = pr.LastViewedAt,
                    rating = pr.Rating,
                    comment = pr.Comment,
                    updatedAt = pr.UpdatedAt
                };

            if (projectId.HasValue)
                q = q.Where(x => x.projectId == projectId.Value);

            if (trainingId.HasValue)
                q = q.Where(x => x.trainingId == trainingId.Value);

            if (onlyCommented == true)
                q = q.Where(x => x.comment != null && x.comment.Trim() != "");

            if (onlyRated == true)
                q = q.Where(x => x.rating != null);

            // default: yorum veya puan varsa getir
            if (onlyCommented != true && onlyRated != true)
                q = q.Where(x => (x.rating != null) || (x.comment != null && x.comment.Trim() != ""));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                q = q.Where(x =>
                    x.email.ToLower().Contains(s) ||
                    x.fullName.ToLower().Contains(s) ||
                    x.trainingTitle.ToLower().Contains(s) ||
                    (x.comment != null && x.comment.ToLower().Contains(s)));
            }

            var rows = await q
                .OrderByDescending(x => x.updatedAt)
                .ToListAsync();

            // summary
            var rated = rows.Where(x => x.rating != null).ToList();
            double? avgRating = rated.Count == 0 ? null : rated.Average(x => (double)x.rating!.Value);

            var stars = new Dictionary<int, int>();
            for (int i = 1; i <= 5; i++)
                stars[i] = rated.Count(x => x.rating == i);

            var summary = new
            {
                totalRows = rows.Count,
                commentCount = rows.Count(x => x.comment != null && x.comment.Trim() != ""),
                ratingCount = rated.Count,
                avgRating,
                stars
            };

            return Ok(new { summary, rows });
        }

        // ------------------------------------------------------------
        // TAB-3: SINAV ANALİZLERİ
        // ------------------------------------------------------------

        // --------------------------------------------------------------------
        // EXAMS LIST (published)
        // GET /api/Analysis/exams
        // --------------------------------------------------------------------
        [HttpGet("exams")]
        public async Task<IActionResult> Exams()
        {
            // "Yayınlanan" = ExamAssignments tablosunda kaydı olan sınav
            var q =
                from e in _db.Exams.AsNoTracking()
                where _db.ExamAssignments.Any(a => a.ExamId == e.Id)
                select new
                {
                    id = e.Id,
                    title = e.Title,
                    durationMinutes = e.DurationMinutes,
                    questionCount = _db.ExamQuestions.Count(x => x.ExamId == e.Id),
                    attemptCount = _db.ExamAttempts
    .Where(a => a.ExamId == e.Id && a.SubmittedAt != null)
    .Select(a => a.UserId)
    .Distinct()
    .Count()

                };

            var data = await q
                .OrderBy(x => x.title)
                .ToListAsync();

            return Ok(data);
        }

        // --------------------------------------------------------------------
        // EXAM QUESTION STATS
        // GET /api/Analysis/exams/{examId}/question-stats
        // --------------------------------------------------------------------
        [HttpGet("exams/{examId:int}/question-stats")]
        public async Task<IActionResult> ExamQuestionStats(int examId)
        {
            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(x => x.Id == examId);
            if (exam is null) return NotFound("Sınav bulunamadı.");

            // Sorular
            var questions = await _db.ExamQuestions.AsNoTracking()
                .Where(q => q.ExamId == examId)
                .OrderBy(q => q.Order)
                .Select(q => new { q.Id, q.Order, q.Text })
                .ToListAsync();

            var qIds = questions.Select(x => x.Id).ToArray();

            // Submit edilmiş attempt'ler
            var bestAttemptIds = await _db.ExamAttempts.AsNoTracking()
    .Where(a => a.ExamId == examId && a.SubmittedAt != null && a.Score != null)
    .GroupBy(a => a.UserId)
    .Select(g => g
        .OrderByDescending(x => x.Score)
        .ThenByDescending(x => x.SubmittedAt)
        .Select(x => x.Id)
        .FirstOrDefault()
    )
    .ToListAsync();

var attemptIds = bestAttemptIds.Where(id => id != 0).ToList();
var attemptCount = attemptIds.Count;


            // Hiç deneme yoksa: sorular 0 istatistikle dönsün (grafik boş kalmasın)
            if (attemptCount == 0)
            {
                var emptyItems = questions.Select(q => new
                {
                    questionId = q.Id,
                    order = q.Order,
                    text = q.Text,
                    totalAnswers = 0,
                    wrongCount = 0,
                    correctCount = attemptCount == 0 ? 0 : 0,
                    wrongRate = 0.0
                })
                .OrderByDescending(x => x.wrongCount)
                .ThenBy(x => x.order)
                .ToList();

                return Ok(new
                {
                    examId = exam.Id,
                    title = exam.Title,
                    attemptCount,
                    items = emptyItems
                });
            }

            // Bu attempt'lere ait cevaplar (sadece bu sınavın soruları)
            var answers = await _db.ExamAttemptAnswers.AsNoTracking()
                .Where(a => attemptIds.Contains(a.AttemptId) && qIds.Contains(a.QuestionId))
                .Select(a => new { a.QuestionId, a.ChoiceId })
                .ToListAsync();

            // Doğru şıklar (1'den fazla doğruya da dayanıklı)
            var correctPairs = await _db.ExamChoices.AsNoTracking()
                .Where(c => qIds.Contains(c.QuestionId) && c.IsCorrect)
                .Select(c => new { c.QuestionId, c.Id })
                .ToListAsync();

            var correctMap = correctPairs
                .GroupBy(x => x.QuestionId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToHashSet());

            var items = new List<object>(questions.Count);

            foreach (var q in questions)
            {
                var qAnswers = answers.Where(a => a.QuestionId == q.Id && a.ChoiceId != null).ToList();
                var total = qAnswers.Count;

                correctMap.TryGetValue(q.Id, out var correctSet);
                correctSet ??= new HashSet<int>();

                var correctCount = qAnswers.Count(a => a.ChoiceId != null && correctSet.Contains(a.ChoiceId.Value));
                var wrongCount = total - correctCount;

                // ✅ 0'a bölme yok
                var wrongRate = total == 0 ? 0.0 : (wrongCount * 100.0) / total;

                items.Add(new
                {
                    questionId = q.Id,
                    order = q.Order,
                    text = q.Text,
                    totalAnswers = total,
                    wrongCount,
                    correctCount,
                    wrongRate = Math.Round(wrongRate, 2)
                });
            }

            // en çok yanlış yapılan sorular üstte
            var ordered = items
                .Cast<dynamic>()
                .OrderByDescending(x => (int)x.wrongCount)
                .ThenBy(x => (int)x.order)
                .ToList();

            return Ok(new
            {
                examId = exam.Id,
                title = exam.Title,
                attemptCount,
                items = ordered
            });
        }
    }
}
