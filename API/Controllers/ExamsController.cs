// Controllers/ExamsController.cs
using API.Data;
using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "admin,trainer,educator")]
    public class ExamsController : ControllerBase
    {
        private readonly AppDbContext _db;
        public ExamsController(AppDbContext db) => _db = db;

        // ----- DTO'lar -----
        public record ChoiceDto(string? text, string? imageUrl, bool isCorrect);
        public record QuestionDto(string text, ChoiceDto[] choices);
        public record CreateExamDto(string title, int? projectId, int durationMinutes, QuestionDto[] questions);

        // ✅ Attempt özelinde kullanıcıya mesaj göndermek için
        public record SendAttemptMessageDto(string message);

        private int CurrentUserId()
{
    var keys = new[] { ClaimTypes.NameIdentifier, "nameid", "sub", "id", "userId" };
    foreach (var k in keys)
    {
        var v = User.FindFirstValue(k);
        if (int.TryParse(v, out var id)) return id;
    }
    throw new Exception("UserId claim not found");
}
        // ✅ POST /api/Exams/attempts/{id}/message
        [HttpPost("attempts/{id:int}/message")]
        public async Task<IActionResult> SendAttemptMessage(int id, [FromBody] SendAttemptMessageDto dto)
        {
            var text = (dto.message ?? "").Trim();
            if (string.IsNullOrWhiteSpace(text))
                return BadRequest(new { message = "Mesaj boş olamaz." });

            var adminId = CurrentUserId();

            var attempt = await _db.ExamAttempts
                .Include(a => a.Exam)
                .Include(a => a.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (attempt is null) return NotFound(new { message = "Attempt bulunamadı." });

            var now = DateTimeOffset.UtcNow;

            // Attempt'e bağlı thread var mı?
            var thread = await _db.SupportThreads
                .FirstOrDefaultAsync(t => t.ExamAttemptId == attempt.Id);

            if (thread == null)
            {
                // proje bağla (varsa)
                var projectId = attempt.Exam.ProjectId ?? attempt.User.ProjectId;

                thread = new SupportThread
                {
                    UserId = attempt.UserId,
                    ProjectId = projectId,
                    ExamAttemptId = attempt.Id,
                    Subject = $"Sınav: {attempt.Exam.Title}",
                    IsClosed = false,
                    CreatedAt = now,
                    UpdatedAt = now,
                    LastMessageAt = now
                };

                _db.SupportThreads.Add(thread);
                await _db.SaveChangesAsync();
            }

            if (thread.IsClosed)
                return BadRequest(new { message = "Bu konuşma kapatılmış." });

            // Mesaj
            _db.SupportMessages.Add(new SupportMessage
            {
                ThreadId = thread.Id,
                SenderUserId = adminId,
                IsFromAdmin = true,
                Body = text,
                CreatedAt = now,
                ReadAtAdmin = now,
                ReadAtUser = null
            });

            thread.UpdatedAt = now;
            thread.LastMessageAt = now;

            await _db.SaveChangesAsync();
            return Ok(new { ok = true, threadId = thread.Id });
        }

        // ============== CREATE ==============
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateExamDto dto)
        {
            if (dto.questions.Length == 0) return BadRequest("En az 1 soru ekleyin.");
            foreach (var q in dto.questions)
                if (q.choices is null || q.choices.Length != 4)
                    return BadRequest("Her soru için 4 şık gereklidir.");

            var exam = new Exam
            {
                Title = dto.title.Trim(),
                ProjectId = dto.projectId,
                DurationMinutes = Math.Max(1, dto.durationMinutes),
                CreatedAt = DateTimeOffset.UtcNow
            };

            int order = 1;
            foreach (var q in dto.questions)
            {
                var qq = new ExamQuestion { Text = q.text.Trim(), Order = order++ };
                foreach (var c in q.choices)
                {
                    qq.Choices.Add(new ExamChoice
                    {
                        Text = string.IsNullOrWhiteSpace(c.text) ? null : c.text!.Trim(),
                        ImageUrl = string.IsNullOrWhiteSpace(c.imageUrl) ? null : c.imageUrl,
                        IsCorrect = c.isCorrect
                    });
                }
                if (!qq.Choices.Any(x => x.IsCorrect))
                    return BadRequest("Her soruda bir doğru şık işaretlenmeli.");
                exam.Questions.Add(qq);
            }

            _db.Exams.Add(exam);
            await _db.SaveChangesAsync();
            return Ok(new { exam.Id });
        }

        // ============== LIST ==============
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? search)
        {
            var q =
                from e in _db.Exams.AsNoTracking()
                join p in _db.Projects.AsNoTracking() on e.ProjectId equals p.Id into gp
                from p in gp.DefaultIfEmpty()
                select new
                {
                    e.Id,
                    e.Title,
                    e.DurationMinutes,
                    projectName = p != null ? p.Name : null,
                    questionCount = _db.ExamQuestions.Count(x => x.ExamId == e.Id)
                };

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                q = q.Where(x => x.Title.ToLower().Contains(s));
            }

            var data = await q.OrderByDescending(x => x.Id).ToListAsync();
            return Ok(data);
        }

        // ============== DETAIL (QUESTIONS) ==============
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Detail(int id)
        {
            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id);
            if (exam is null) return NotFound();

            var items =
                await (from q in _db.ExamQuestions.AsNoTracking().Where(x => x.ExamId == id)
                       orderby q.Order
                       select new
                       {
                           q.Id,
                           q.Text,
                           choices = _db.ExamChoices
                               .Where(c => c.QuestionId == q.Id)
                               .Select(c => new { c.Id, c.Text, c.ImageUrl, c.IsCorrect })
                               .ToList()
                       }).ToListAsync();

            return Ok(new
            {
                exam.Id,
                exam.Title,
                exam.DurationMinutes,
                exam.ProjectId,
                questions = items
            });
        }
        
        // ============== DELETE ==============
[HttpDelete("{id:int}")]
public async Task<IActionResult> Delete(int id)
{
    var exam = await _db.Exams.FirstOrDefaultAsync(x => x.Id == id);
    if (exam is null) return NotFound();

    // Güvenli silme: sınava bağlı her şeyi temizle
    await using var tx = await _db.Database.BeginTransactionAsync();

    // 1) Attempts
    var attemptIds = await _db.ExamAttempts
        .Where(a => a.ExamId == id)
        .Select(a => a.Id)
        .ToListAsync();

    // 1.a) SupportThreads & SupportMessages (attempt’e bağlı konuşmalar varsa)
    var threadIds = await _db.SupportThreads
        .Where(t => t.ExamAttemptId != null && attemptIds.Contains(t.ExamAttemptId.Value))
        .Select(t => t.Id)
        .ToListAsync();

    if (threadIds.Count > 0)
    {
        _db.SupportMessages.RemoveRange(_db.SupportMessages.Where(m => threadIds.Contains(m.ThreadId)));
        _db.SupportThreads.RemoveRange(_db.SupportThreads.Where(t => threadIds.Contains(t.Id)));
    }

    // 1.b) Attempt Answers
    if (attemptIds.Count > 0)
    {
        _db.ExamAttemptAnswers.RemoveRange(_db.ExamAttemptAnswers.Where(x => attemptIds.Contains(x.AttemptId)));
        _db.ExamAttempts.RemoveRange(_db.ExamAttempts.Where(x => attemptIds.Contains(x.Id)));
    }

    // 2) Assignments (publish)
    _db.ExamAssignments.RemoveRange(_db.ExamAssignments.Where(x => x.ExamId == id));

    // 3) Questions + Choices
    var questionIds = await _db.ExamQuestions
        .Where(q => q.ExamId == id)
        .Select(q => q.Id)
        .ToListAsync();

    if (questionIds.Count > 0)
    {
        _db.ExamChoices.RemoveRange(_db.ExamChoices.Where(c => questionIds.Contains(c.QuestionId)));
        _db.ExamQuestions.RemoveRange(_db.ExamQuestions.Where(q => questionIds.Contains(q.Id)));
    }

    // 4) Exam
    _db.Exams.Remove(exam);

    await _db.SaveChangesAsync();
    await tx.CommitAsync();

    return NoContent();
}


        // ============== ASSIGN (publish / unpublish) ==============
        public sealed record AssignUsersDto(int[] examIds, int[] userIds);
        public sealed record AssignProjectDto(int[] examIds, int projectId);

        [HttpGet("assign-data")]
        public async Task<IActionResult> AssignData()
        {
            var exams = await _db.Exams.OrderBy(x => x.Title).Select(x => new { x.Id, x.Title }).ToListAsync();
            var users = await _db.Users.OrderBy(x => x.Email)
                .Select(x => new { x.Id, fullName = x.Name + " " + x.Surname, x.Email }).ToListAsync();
            var projects = await _db.Projects.OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync();
            return Ok(new { exams, users, projects });
        }

        // ============== ATTEMPT REVIEW (Admin) ==============
        [HttpGet("attempts/{id:int}/review")]
        public async Task<IActionResult> AttemptReview(int id)
        {
            var a = await _db.ExamAttempts
                .Include(x => x.Exam)
                .Include(x => x.User)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);

            if (a is null) return NotFound();

            var questions = await _db.ExamQuestions.AsNoTracking()
                .Where(q => q.ExamId == a.ExamId)
                .OrderBy(q => q.Order)
                .Select(q => new
                {
                    questionId = q.Id,
                    order = q.Order,
                    text = q.Text,
                    choices = _db.ExamChoices.AsNoTracking()
                        .Where(c => c.QuestionId == q.Id)
                        .Select(c => new { c.Id, c.Text, c.ImageUrl, c.IsCorrect })
                        .ToList()
                })
                .ToListAsync();

            var answers = await _db.ExamAttemptAnswers.AsNoTracking()
                .Where(x => x.AttemptId == a.Id)
                .Select(x => new { x.QuestionId, x.ChoiceId })
                .ToListAsync();

            var answerMap = answers
                .Where(x => x.ChoiceId != null)
                .ToDictionary(x => x.QuestionId, x => x.ChoiceId!.Value);

            var rows = questions.Select(q =>
            {
                answerMap.TryGetValue(q.questionId, out var picked);
                var correctIds = q.choices.Where(c => c.IsCorrect).Select(c => c.Id).ToHashSet();
                var isCorrect = picked != 0 && correctIds.Contains(picked);

                return new
                {
                    q.questionId,
                    q.order,
                    q.text,
                    q.choices,
                    selectedChoiceId = picked == 0 ? (int?)null : picked,
                    isCorrect
                };
            });

            return Ok(new
            {
                attemptId = a.Id,
                examTitle = a.Exam.Title,
                user = a.User.Name + " " + a.User.Surname + " (" + a.User.Email + ")",
                startedAt = a.StartedAt,
                submittedAt = a.SubmittedAt,
                score = a.Score,
                isPassed = a.IsPassed,
                questions = rows
            });
        }

        [HttpPost("assign-to-users")]
        public async Task<IActionResult> AssignToUsers([FromBody] AssignUsersDto dto)
        {
            if (dto.examIds.Length == 0 || dto.userIds.Length == 0) return BadRequest();

            var existing = await _db.ExamAssignments
                .Where(x => dto.examIds.Contains(x.ExamId) && x.UserId != null && dto.userIds.Contains(x.UserId.Value))
                .Select(x => new { x.ExamId, x.UserId })
                .ToListAsync();

            var set = new HashSet<(int e, int u)>(existing.Select(e => (e.ExamId, e.UserId!.Value)));
            var now = DateTimeOffset.UtcNow;

            foreach (var eid in dto.examIds.Distinct())
            foreach (var uid in dto.userIds.Distinct())
                if (!set.Contains((eid, uid)))
                    _db.ExamAssignments.Add(new ExamAssignment { ExamId = eid, UserId = uid, CreatedAt = now });

            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("assign-to-project")]
        public async Task<IActionResult> AssignToProject([FromBody] AssignProjectDto dto)
        {
            if (dto.examIds.Length == 0) return BadRequest();

            var existing = await _db.ExamAssignments
                .Where(x => dto.examIds.Contains(x.ExamId) && x.ProjectId == dto.projectId)
                .Select(x => x.ExamId).ToListAsync();

            var set = new HashSet<int>(existing);
            var now = DateTimeOffset.UtcNow;

            foreach (var eid in dto.examIds.Distinct())
                if (!set.Contains(eid))
                    _db.ExamAssignments.Add(new ExamAssignment { ExamId = eid, ProjectId = dto.projectId, CreatedAt = now });

            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpGet("assignments")]
        public async Task<IActionResult> Assignments([FromQuery] string? search)
        {
            var q = _db.ExamAssignments
                .Include(x => x.Exam)
                .Include(x => x.User)
                .Include(x => x.Project)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                q = q.Where(x =>
                    x.Exam.Title.ToLower().Contains(s) ||
                    (x.User != null && (x.User.Email.ToLower().Contains(s) ||
                     (x.User.Name + " " + x.User.Surname).ToLower().Contains(s))) ||
                    (x.Project != null && x.Project.Name.ToLower().Contains(s)));
            }

            var data = await q.OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    x.Id,
                    createdAt = x.CreatedAt,
                    examId = x.ExamId,
                    examTitle = x.Exam.Title,
                    kind = x.UserId != null ? "user" : "project",
                    targetName = x.UserId != null
                        ? (x.User!.Name + " " + x.User!.Surname + " (" + x.User!.Email + ")")
                        : x.Project!.Name
                })
                .ToListAsync();

            return Ok(data);
        }

        [HttpDelete("assignments/{id:int}")]
        public async Task<IActionResult> DeleteAssignment(int id)
        {
            var a = await _db.ExamAssignments.FindAsync(id);
            if (a is null) return NotFound();
            _db.ExamAssignments.Remove(a);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ============== CONTROL (Attempts) ==============
        [HttpGet("attempts")]
        public async Task<IActionResult> Attempts([FromQuery] int? examId, [FromQuery] string? search)
        {
            var attempts = _db.ExamAttempts
                .Include(a => a.Exam)
                .Include(a => a.User)
                .AsNoTracking()
                .Where(a => a.SubmittedAt != null);

            if (examId.HasValue) attempts = attempts.Where(a => a.ExamId == examId.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                attempts = attempts.Where(a =>
                    a.Exam.Title.ToLower().Contains(s) ||
                    a.User.Email.ToLower().Contains(s) ||
                    (a.User.Name + " " + a.User.Surname).ToLower().Contains(s));
            }

            var data = await attempts
                .OrderByDescending(a => a.SubmittedAt)
                .Select(a => new
                {
                    a.Id,
                    a.ExamId,
                    examTitle = a.Exam.Title,
                    user = a.User.Name + " " + a.User.Surname + " (" + a.User.Email + ")",
                    a.StartedAt,
                    a.SubmittedAt,
                    a.Score,
                    a.IsPassed
                }).ToListAsync();

            return Ok(data);
        }

        public record OverrideDto(double score, string? note, bool? isPassed);

        [HttpPost("attempts/{id:int}/override")]
        public async Task<IActionResult> OverrideScore(int id, [FromBody] OverrideDto dto)
        {
            var a = await _db.ExamAttempts.FindAsync(id);
            if (a is null) return NotFound();
            a.Score = dto.score;
            a.IsPassed = dto.isPassed ?? (dto.score >= 70.0);
            a.Note = dto.note;
            await _db.SaveChangesAsync();
            return Ok();
        }
    }
}
