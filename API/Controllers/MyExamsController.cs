// MyExamsController.cs
using API.Data;
using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MyExamsController : ControllerBase
    {
        private readonly AppDbContext _db;
        public MyExamsController(AppDbContext db) => _db = db;

        /* ===================== NEW: Shuffle Helpers ===================== */

        private sealed class AttemptShuffleState
        {
            public int[] QuestionIds { get; set; } = Array.Empty<int>();
            public Dictionary<int, int[]> ChoiceIdsByQuestion { get; set; } = new();
        }

        private static readonly JsonSerializerOptions _json = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        private static void ShuffleInPlace<T>(IList<T> list, Random rng)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = rng.Next(i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }

        private async Task<AttemptShuffleState> EnsureShuffleAsync(ExamAttempt attempt, int examId)
        {
            // varsa parse edip dön
            if (!string.IsNullOrWhiteSpace(attempt.ShuffleJson))
            {
                try
                {
                    var existing = JsonSerializer.Deserialize<AttemptShuffleState>(attempt.ShuffleJson!, _json);
                    if (existing != null && existing.QuestionIds.Length > 0)
                        return existing;
                }
                catch
                {
                    // bozuk json -> aşağıda yeniden üret
                }
            }

            // exam'ın soruları + şık ID'leri
            var qData = await _db.ExamQuestions.AsNoTracking()
                .Where(q => q.ExamId == examId)
                .Select(q => new
                {
                    q.Id,
                    ChoiceIds = _db.ExamChoices.AsNoTracking()
                        .Where(c => c.QuestionId == q.Id)
                        .Select(c => c.Id)
                        .ToList()
                })
                .ToListAsync();

            var seed = RandomNumberGenerator.GetInt32(int.MaxValue);
            var rng = new Random(seed);

            var qIds = qData.Select(x => x.Id).ToList();
            ShuffleInPlace(qIds, rng);

            var map = new Dictionary<int, int[]>();
            foreach (var q in qData)
            {
                var cIds = q.ChoiceIds.ToList();
                ShuffleInPlace(cIds, rng);
                map[q.Id] = cIds.ToArray();
            }

            var state = new AttemptShuffleState
            {
                QuestionIds = qIds.ToArray(),
                ChoiceIdsByQuestion = map
            };

            attempt.ShuffleJson = JsonSerializer.Serialize(state, _json);
            await _db.SaveChangesAsync();

            return state;
        }

        /* ===================== Auth Helpers ===================== */

        private int GetUserId()
        {
            var s = User.FindFirst("id")?.Value
                    ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(s) || !int.TryParse(s, out var id))
                throw new UnauthorizedAccessException("User id claim not found.");

            return id;
        }

        private async Task<User?> GetUserEntity(int userId) =>
            await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);

        /* ===================== ✅ Multi Project Helper ===================== */
        // Users.ProjectId (primary) + UserProjects (many-to-many) birleşik proje listesi
        private async Task<List<int>> GetUserProjectIds(int userId)
        {
            var primary = await _db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.ProjectId)
                .FirstOrDefaultAsync();

            var extras = await _db.UserProjects.AsNoTracking()
                .Where(up => up.UserId == userId)
                .Select(up => up.ProjectId)
                .ToListAsync();

            if (primary != null)
                extras.Add(primary.Value);

            return extras.Distinct().ToList();
        }

        /* ===================== Access Checks ===================== */

        private async Task<bool> HasExamAccess(int userId, int examId)
        {
            var projectIds = await GetUserProjectIds(userId);

            return await _db.ExamAssignments.AsNoTracking().AnyAsync(a =>
                a.ExamId == examId &&
                (
                    (a.UserId != null && a.UserId.Value == userId) ||
                    (a.ProjectId != null && projectIds.Contains(a.ProjectId.Value))
                )
            );
        }

        /* ===================== ✅ NEW: NAV + LIST + EXAM DETAIL ===================== */
        // UserLayout.tsx     -> GET /api/MyExams/nav
        // UserExams.tsx      -> GET /api/MyExams/list?search=
        // UserExamDetail.tsx -> GET /api/MyExams/exam/{examId}

        private async Task<List<int>> GetAssignedExamIds(int userId)
        {
            var projectIds = await GetUserProjectIds(userId);

            return await _db.ExamAssignments.AsNoTracking()
                .Where(a =>
                    (a.UserId != null && a.UserId.Value == userId) ||
                    (a.ProjectId != null && projectIds.Contains(a.ProjectId.Value))
                )
                .Select(a => a.ExamId)
                .Distinct()
                .ToListAsync();
        }

        // ✅ Nav/List içinde "süresi geçmiş açık attempt" varsa otomatik submit et
        private async Task AutoSubmitExpiredOpenAttempts(int userId, List<int> examIds)
        {
            if (examIds.Count == 0) return;

            var open = await _db.ExamAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && examIds.Contains(a.ExamId) && a.SubmittedAt == null)
                .Join(_db.Exams.AsNoTracking(),
                    a => a.ExamId,
                    e => e.Id,
                    (a, e) => new { AttemptId = a.Id, a.StartedAt, e.DurationMinutes })
                .ToListAsync();

            var now = DateTimeOffset.UtcNow;

            foreach (var x in open)
            {
                var endsAt = x.StartedAt.AddMinutes(x.DurationMinutes);
                if (now >= endsAt)
                {
                    await FinalizeAttempt(x.AttemptId, auto: true, submittedAt: endsAt);
                }
            }
        }

        // ✅ GET /api/MyExams/nav
        [HttpGet("nav")]
        public async Task<IActionResult> Nav()
        {
            var userId = GetUserId();
            var examIds = await GetAssignedExamIds(userId);

            if (examIds.Count == 0)
                return Ok(Array.Empty<object>());

            // expired open attempts varsa tamamla
            await AutoSubmitExpiredOpenAttempts(userId, examIds);

            var exams = await _db.Exams.AsNoTracking()
                .Where(e => examIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Title })
                .OrderBy(e => e.Title)
                .ToListAsync();

            // açık attempt (SubmittedAt null)
            var openAttempts = await _db.ExamAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && examIds.Contains(a.ExamId) && a.SubmittedAt == null)
                .Select(a => new { a.ExamId, a.Id })
                .ToListAsync();

            var openDict = openAttempts.ToDictionary(x => x.ExamId, x => x.Id);

            // son submitted attempt
            var submittedAttempts = await _db.ExamAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && examIds.Contains(a.ExamId) && a.SubmittedAt != null)
                .OrderByDescending(a => a.SubmittedAt)
                .Select(a => new { a.ExamId, a.Id, a.Score, a.IsPassed })
                .ToListAsync();

            var lastSubmittedDict = new Dictionary<int, (int attemptId, double? score, bool? isPassed)>();
            foreach (var a in submittedAttempts)
            {
                if (!lastSubmittedDict.ContainsKey(a.ExamId))
                    lastSubmittedDict[a.ExamId] = (a.Id, a.Score, a.IsPassed);
            }

            var result = exams.Select(e =>
            {
                if (openDict.TryGetValue(e.Id, out var openId))
                {
                    return new
                    {
                        examId = e.Id,
                        title = e.Title,
                        status = "in_progress",
                        attemptId = (int?)openId,
                        score = (double?)null,
                        isPassed = (bool?)null
                    };
                }

                if (lastSubmittedDict.TryGetValue(e.Id, out var last))
                {
                    return new
                    {
                        examId = e.Id,
                        title = e.Title,
                        status = "completed",
                        attemptId = (int?)last.attemptId,
                        score = last.score,
                        isPassed = last.isPassed
                    };
                }

                return new
                {
                    examId = e.Id,
                    title = e.Title,
                    status = "not_started",
                    attemptId = (int?)null,
                    score = (double?)null,
                    isPassed = (bool?)null
                };
            }).ToList();

            return Ok(result);
        }

        // ✅ GET /api/MyExams/list?search=
        [HttpGet("list")]
        public async Task<IActionResult> List([FromQuery] string? search)
        {
            var userId = GetUserId();
            var examIds = await GetAssignedExamIds(userId);

            if (examIds.Count == 0)
                return Ok(Array.Empty<object>());

            // expired open attempts varsa tamamla
            await AutoSubmitExpiredOpenAttempts(userId, examIds);

            var examsQuery = _db.Exams.AsNoTracking()
                .Where(e => examIds.Contains(e.Id));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                examsQuery = examsQuery.Where(e => e.Title.ToLower().Contains(s));
            }

            var exams = await examsQuery
                .Select(e => new { e.Id, e.Title, e.DurationMinutes })
                .OrderBy(e => e.Title)
                .ToListAsync();

            var ids = exams.Select(e => e.Id).ToList();
            if (ids.Count == 0) return Ok(Array.Empty<object>());

            var qCounts = await _db.ExamQuestions.AsNoTracking()
                .Where(q => ids.Contains(q.ExamId))
                .GroupBy(q => q.ExamId)
                .Select(g => new { ExamId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ExamId, x => x.Count);

            var openAttempts = await _db.ExamAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && ids.Contains(a.ExamId) && a.SubmittedAt == null)
                .Select(a => new { a.ExamId, a.Id })
                .ToListAsync();
            var openDict = openAttempts.ToDictionary(x => x.ExamId, x => x.Id);

            var submittedAttempts = await _db.ExamAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && ids.Contains(a.ExamId) && a.SubmittedAt != null)
                .OrderByDescending(a => a.SubmittedAt)
                .Select(a => new { a.ExamId, a.Id, a.Score, a.IsPassed })
                .ToListAsync();

            var lastSubmittedDict = new Dictionary<int, (int attemptId, double? score, bool? isPassed)>();
            foreach (var a in submittedAttempts)
            {
                if (!lastSubmittedDict.ContainsKey(a.ExamId))
                    lastSubmittedDict[a.ExamId] = (a.Id, a.Score, a.IsPassed);
            }

            var rows = exams.Select(e =>
            {
                var questionCount = qCounts.TryGetValue(e.Id, out var cnt) ? cnt : 0;

                if (openDict.TryGetValue(e.Id, out var openId))
                {
                    return new
                    {
                        examId = e.Id,
                        title = e.Title,
                        durationMinutes = e.DurationMinutes,
                        questionCount,
                        status = "in_progress",
                        attemptId = (int?)openId,
                        score = (double?)null,
                        isPassed = (bool?)null
                    };
                }

                if (lastSubmittedDict.TryGetValue(e.Id, out var last))
                {
                    return new
                    {
                        examId = e.Id,
                        title = e.Title,
                        durationMinutes = e.DurationMinutes,
                        questionCount,
                        status = "completed",
                        attemptId = (int?)last.attemptId,
                        score = last.score,
                        isPassed = last.isPassed
                    };
                }

                return new
                {
                    examId = e.Id,
                    title = e.Title,
                    durationMinutes = e.DurationMinutes,
                    questionCount,
                    status = "not_started",
                    attemptId = (int?)null,
                    score = (double?)null,
                    isPassed = (bool?)null
                };
            }).ToList();

            return Ok(rows);
        }

        // ✅ GET /api/MyExams/exam/{examId:int}
        // UserExamDetail.tsx bunu çağırıyor
        [HttpGet("exam/{examId:int}")]
        public async Task<IActionResult> ExamDetail(int examId)
        {
            var userId = GetUserId();

            if (!await HasExamAccess(userId, examId))
                return Forbid();

            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(e => e.Id == examId);
            if (exam is null) return NotFound();

            var questionCount = await _db.ExamQuestions.AsNoTracking()
                .CountAsync(q => q.ExamId == examId);

            // expired open attempts varsa tamamla (tek sınav için)
            await AutoSubmitExpiredOpenAttempts(userId, new List<int> { examId });

            var open = await _db.ExamAttempts.AsNoTracking()
                .FirstOrDefaultAsync(a => a.UserId == userId && a.ExamId == examId && a.SubmittedAt == null);

            if (open != null)
            {
                return Ok(new
                {
                    examId = exam.Id,
                    title = exam.Title,
                    durationMinutes = exam.DurationMinutes,
                    questionCount,
                    status = "in_progress",
                    attemptId = (int?)open.Id,
                    score = (double?)null,
                    isPassed = (bool?)null
                });
            }

            var last = await _db.ExamAttempts.AsNoTracking()
                .Where(a => a.UserId == userId && a.ExamId == examId && a.SubmittedAt != null)
                .OrderByDescending(a => a.SubmittedAt)
                .Select(a => new { a.Id, a.Score, a.IsPassed })
                .FirstOrDefaultAsync();

            if (last != null)
            {
                return Ok(new
                {
                    examId = exam.Id,
                    title = exam.Title,
                    durationMinutes = exam.DurationMinutes,
                    questionCount,
                    status = "completed",
                    attemptId = (int?)last.Id,
                    score = last.Score,
                    isPassed = last.IsPassed
                });
            }

            return Ok(new
            {
                examId = exam.Id,
                title = exam.Title,
                durationMinutes = exam.DurationMinutes,
                questionCount,
                status = "not_started",
                attemptId = (int?)null,
                score = (double?)null,
                isPassed = (bool?)null
            });
        }

        /* ===================== Auto Submit ===================== */

        private async Task<(bool autoSubmitted, string? message)> EnsureAutoSubmitIfExpired(ExamAttempt attempt, Exam exam)
        {
            if (attempt.SubmittedAt != null) return (false, null);

            var endsAt = attempt.StartedAt.AddMinutes(exam.DurationMinutes);
            if (DateTimeOffset.UtcNow < endsAt) return (false, null);

            await FinalizeAttempt(attempt.Id, auto: true, submittedAt: endsAt);
            return (true, "Sınav süresi tamamlandı. Cevaplarınız kaydedildi.");
        }

        private async Task FinalizeAttempt(int attemptId, bool auto, DateTimeOffset? submittedAt = null)
        {
            var attempt = await _db.ExamAttempts.FirstOrDefaultAsync(x => x.Id == attemptId);
            if (attempt is null) return;
            if (attempt.SubmittedAt != null) return;

            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attempt.ExamId);
            if (exam is null) return;

            var questions = await _db.ExamQuestions.AsNoTracking()
                .Where(q => q.ExamId == exam.Id)
                .OrderBy(q => q.Order)
                .Select(q => new
                {
                    q.Id,
                    Choices = _db.ExamChoices.AsNoTracking()
                        .Where(c => c.QuestionId == q.Id)
                        .Select(c => new { c.Id, c.IsCorrect })
                        .ToList()
                })
                .ToListAsync();

            var qIds = questions.Select(x => x.Id).ToList();

            var answers = await _db.ExamAttemptAnswers.AsNoTracking()
                .Where(a => a.AttemptId == attemptId && qIds.Contains(a.QuestionId))
                .Select(a => new { a.QuestionId, a.ChoiceId })
                .ToListAsync();

            var map = answers
                .Where(x => x.ChoiceId != null)
                .ToDictionary(x => x.QuestionId, x => x.ChoiceId!.Value);

            int correct = 0;
            foreach (var q in questions)
            {
                var correctSet = q.Choices.Where(c => c.IsCorrect).Select(c => c.Id).ToHashSet();
                if (map.TryGetValue(q.Id, out var picked) && correctSet.Contains(picked))
                    correct++;
            }

            var total = Math.Max(1, questions.Count);
            var score = (double)correct * 100.0 / total;

            attempt.Score = Math.Round(score, 1);
            attempt.IsPassed = attempt.Score >= 70.0;

            var submitAt = submittedAt ?? DateTimeOffset.UtcNow;
            attempt.SubmittedAt = submitAt;
            attempt.DurationUsedSec = (int)Math.Max(0, (submitAt - attempt.StartedAt).TotalSeconds);

            // ✅ 70 altı ise: kullanıcıya atanmış tüm eğitimleri sıfırla
            if (attempt.IsPassed == false)
            {
                await ResetAssignedTrainings(attempt.UserId, submitAt);
            }

            await _db.SaveChangesAsync();
        }

        /* ===================== START ===================== */

        // POST /api/MyExams/start/{examId}
        [HttpPost("start/{examId:int}")]
        public async Task<IActionResult> Start(int examId)
        {
            var userId = GetUserId();
            if (!await HasExamAccess(userId, examId)) return Forbid();

            var exam = await _db.Exams.FirstOrDefaultAsync(e => e.Id == examId);
            if (exam is null) return NotFound();

            var passedBefore = await _db.ExamAttempts.AsNoTracking()
                .AnyAsync(a => a.UserId == userId && a.ExamId == examId && a.SubmittedAt != null && a.IsPassed == true);

            if (passedBefore)
                return Conflict(new { message = "Bu sınavı zaten başarıyla tamamladınız." });

            var incomplete = await GetIncompleteTrainingIds(userId);
            if (incomplete.Count > 0)
            {
                return BadRequest(new
                {
                    code = "TRAININGS_NOT_COMPLETED",
                    message = "Sınava girebilmek için size atanmış tüm eğitimleri tamamlamalısınız.",
                    incompleteTrainingCount = incomplete.Count,
                    incompleteTrainingIds = incomplete
                });
            }

            // açık attempt varsa onu döndür
            var open = await _db.ExamAttempts
                .FirstOrDefaultAsync(a => a.UserId == userId && a.ExamId == examId && a.SubmittedAt == null);

            if (open != null)
            {
                var (auto, msg) = await EnsureAutoSubmitIfExpired(open, exam);
                if (auto)
                {
                    return Ok(new
                    {
                        attemptId = open.Id,
                        examId = exam.Id,
                        title = exam.Title,
                        durationMinutes = exam.DurationMinutes,
                        startedAt = open.StartedAt,
                        submittedAt = open.SubmittedAt,
                        autoSubmitted = true,
                        message = msg
                    });
                }

                return Ok(new
                {
                    attemptId = open.Id,
                    examId = exam.Id,
                    title = exam.Title,
                    durationMinutes = exam.DurationMinutes,
                    startedAt = open.StartedAt,
                    endsAt = open.StartedAt.AddMinutes(exam.DurationMinutes),
                    serverNow = DateTimeOffset.UtcNow
                });
            }

            var now2 = DateTimeOffset.UtcNow;
            var attempt = new ExamAttempt
            {
                ExamId = exam.Id,
                UserId = userId,
                StartedAt = now2
            };

            _db.ExamAttempts.Add(attempt);
            await _db.SaveChangesAsync();

            // attempt oluşur oluşmaz soru+şık sırası üret ve sakla
            await EnsureShuffleAsync(attempt, exam.Id);

            return Ok(new
            {
                attemptId = attempt.Id,
                examId = exam.Id,
                title = exam.Title,
                durationMinutes = exam.DurationMinutes,
                startedAt = attempt.StartedAt,
                endsAt = attempt.StartedAt.AddMinutes(exam.DurationMinutes),
                serverNow = DateTimeOffset.UtcNow
            });
        }

        /* ===================== ATTEMPT DETAIL ===================== */

        // GET /api/MyExams/attempt/{attemptId}
        [HttpGet("attempt/{attemptId:int}")]
        public async Task<IActionResult> AttemptDetail(int attemptId)
        {
            var userId = GetUserId();

            var attempt = await _db.ExamAttempts.FirstOrDefaultAsync(a => a.Id == attemptId);
            if (attempt is null) return NotFound();
            if (attempt.UserId != userId) return Forbid();

            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attempt.ExamId);
            if (exam is null) return NotFound();

            var (auto, msg) = await EnsureAutoSubmitIfExpired(attempt, exam);

            // attempt'e özel shuffle state (yoksa üret)
            var shuffle = await EnsureShuffleAsync(attempt, exam.Id);

            // ham veriyi çek
            var rawQuestions = await _db.ExamQuestions.AsNoTracking()
                .Where(q => q.ExamId == exam.Id)
                .Select(q => new
                {
                    id = q.Id,
                    text = q.Text,
                    choices = _db.ExamChoices.AsNoTracking()
                        .Where(c => c.QuestionId == q.Id)
                        .Select(c => new { id = c.Id, text = c.Text, imageUrl = c.ImageUrl })
                        .ToList()
                })
                .ToListAsync();

            var qDict = rawQuestions.ToDictionary(x => x.id, x => x);

            // soruları shuffle sırasına göre diz
            var orderedQuestions = new List<object>();
            int order = 1;

            var effectiveQIds = (shuffle.QuestionIds?.Length > 0)
                ? shuffle.QuestionIds
                : rawQuestions.Select(x => x.id).ToArray();

            foreach (var qid in effectiveQIds)
            {
                if (!qDict.TryGetValue(qid, out var q)) continue;

                var choiceDict = q.choices.ToDictionary(c => c.id, c => c);

                int[] choiceOrder =
                    (shuffle.ChoiceIdsByQuestion != null
                     && shuffle.ChoiceIdsByQuestion.TryGetValue(qid, out var arr)
                     && arr.Length > 0)
                        ? arr
                        : q.choices.Select(c => c.id).ToArray();

                var orderedChoices = choiceOrder
                    .Where(cid => choiceDict.ContainsKey(cid))
                    .Select(cid => choiceDict[cid])
                    .ToList();

                // fallback: json eksikse kalanları ekle
                if (orderedChoices.Count != q.choices.Count)
                {
                    var used = orderedChoices.Select(x => x.id).ToHashSet();
                    orderedChoices.AddRange(q.choices.Where(c => !used.Contains(c.id)));
                }

                orderedQuestions.Add(new
                {
                    id = q.id,
                    order = order++,
                    text = q.text,
                    choices = orderedChoices
                });
            }

            var answers = await _db.ExamAttemptAnswers.AsNoTracking()
                .Where(a => a.AttemptId == attemptId)
                .Select(a => new { questionId = a.QuestionId, choiceId = a.ChoiceId })
                .ToListAsync();

            return Ok(new
            {
                attemptId = attempt.Id,
                examId = exam.Id,
                title = exam.Title,
                durationMinutes = exam.DurationMinutes,
                startedAt = attempt.StartedAt,
                endsAt = attempt.StartedAt.AddMinutes(exam.DurationMinutes),
                serverNow = DateTimeOffset.UtcNow,

                submittedAt = attempt.SubmittedAt,
                score = attempt.Score,
                isPassed = attempt.IsPassed,
                autoSubmitted = auto,
                message = msg,

                questions = orderedQuestions,
                answers
            });
        }

        /* ===================== SAVE ANSWER ===================== */

        public sealed record SaveAnswerDto(int questionId, int choiceId);

        // POST /api/MyExams/attempt/{attemptId}/answer
        [HttpPost("attempt/{attemptId:int}/answer")]
        public async Task<IActionResult> SaveAnswer(int attemptId, [FromBody] SaveAnswerDto dto)
        {
            var userId = GetUserId();

            var attempt = await _db.ExamAttempts.FirstOrDefaultAsync(a => a.Id == attemptId);
            if (attempt is null) return NotFound();
            if (attempt.UserId != userId) return Forbid();

            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attempt.ExamId);
            if (exam is null) return NotFound();

            var (auto, msg) = await EnsureAutoSubmitIfExpired(attempt, exam);
            if (auto) return Conflict(new { message = msg });

            if (attempt.SubmittedAt != null)
                return Conflict(new { message = "Sınav zaten bitmiş." });

            var questionOk = await _db.ExamQuestions.AsNoTracking()
                .AnyAsync(q => q.Id == dto.questionId && q.ExamId == exam.Id);
            if (!questionOk) return BadRequest(new { message = "Geçersiz soru." });

            var choiceOk = await _db.ExamChoices.AsNoTracking()
                .AnyAsync(c => c.Id == dto.choiceId && c.QuestionId == dto.questionId);
            if (!choiceOk) return BadRequest(new { message = "Geçersiz şık." });

            var now = DateTimeOffset.UtcNow;
            var row = await _db.ExamAttemptAnswers
                .FirstOrDefaultAsync(x => x.AttemptId == attemptId && x.QuestionId == dto.questionId);

            if (row == null)
            {
                _db.ExamAttemptAnswers.Add(new ExamAttemptAnswer
                {
                    AttemptId = attemptId,
                    QuestionId = dto.questionId,
                    ChoiceId = dto.choiceId,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            else
            {
                row.ChoiceId = dto.choiceId;
                row.UpdatedAt = now;
            }

            await _db.SaveChangesAsync();
            return Ok();
        }

        /* ===================== SUBMIT ===================== */

        // POST /api/MyExams/attempt/{attemptId}/submit
        [HttpPost("attempt/{attemptId:int}/submit")]
        public async Task<IActionResult> Submit(int attemptId)
        {
            var userId = GetUserId();

            var attempt = await _db.ExamAttempts.FirstOrDefaultAsync(a => a.Id == attemptId);
            if (attempt is null) return NotFound();
            if (attempt.UserId != userId) return Forbid();

            var exam = await _db.Exams.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attempt.ExamId);
            if (exam is null) return NotFound();

            var endsAt = attempt.StartedAt.AddMinutes(exam.DurationMinutes);
            var auto = DateTimeOffset.UtcNow >= endsAt;

            await FinalizeAttempt(attemptId, auto: auto, submittedAt: auto ? endsAt : null);

            var refreshed = await _db.ExamAttempts.AsNoTracking().FirstAsync(x => x.Id == attemptId);

            return Ok(new
            {
                attemptId = refreshed.Id,
                submittedAt = refreshed.SubmittedAt,
                score = refreshed.Score,
                isPassed = refreshed.IsPassed,
                autoSubmitted = auto,
                message = auto ? "Sınav süresi tamamlandı. Cevaplarınız kaydedildi." : null
            });
        }

        /* ===================== Training Gate + Reset (✅ Multi Project) ===================== */

        private async Task<List<int>> GetAssignedTrainingIds(int userId)
        {
            var projectIds = await GetUserProjectIds(userId);

            var direct = _db.TrainingAssignments.AsNoTracking()
                .Where(a => a.UserId != null && a.UserId.Value == userId)
                .Select(a => a.TrainingId);

            IQueryable<int> project = Enumerable.Empty<int>().AsQueryable();
            if (projectIds.Count > 0)
            {
                project = _db.TrainingAssignments.AsNoTracking()
                    .Where(a => a.ProjectId != null && projectIds.Contains(a.ProjectId.Value))
                    .Select(a => a.TrainingId);
            }

            return await direct.Concat(project).Distinct().ToListAsync();
        }

        private async Task<List<int>> GetIncompleteTrainingIds(int userId)
        {
            var all = await GetAssignedTrainingIds(userId);
            if (all.Count == 0) return new List<int>();

            var completed = await _db.TrainingProgresses.AsNoTracking()
                .Where(tp => tp.UserId == userId && all.Contains(tp.TrainingId) && tp.Progress >= 100)
                .Select(tp => tp.TrainingId)
                .Distinct()
                .ToListAsync();

            return all.Except(completed).ToList();
        }

        private async Task ResetAssignedTrainings(int userId, DateTimeOffset now)
        {
            var trainingIds = await GetAssignedTrainingIds(userId);
            if (trainingIds.Count == 0) return;

            var progresses = await _db.TrainingProgresses
                .Where(tp => tp.UserId == userId && trainingIds.Contains(tp.TrainingId))
                .ToListAsync();

            var existingIds = progresses.Select(x => x.TrainingId).ToHashSet();
            var missing = trainingIds.Where(id => !existingIds.Contains(id)).ToList();

            foreach (var tid in missing)
            {
                var p = new TrainingProgress
                {
                    UserId = userId,
                    TrainingId = tid,
                    Progress = 0,
                    Rating = null,
                    Comment = null,
                    CreatedAt = now,
                    UpdatedAt = now,
                    LastViewedAt = null,
                    CompletedAt = null
                };
                _db.TrainingProgresses.Add(p);
                progresses.Add(p);
            }

            foreach (var tp in progresses)
            {
                tp.Progress = 0;
                tp.LastViewedAt = null;
                tp.CompletedAt = null;
                tp.Rating = null;
                tp.Comment = null;
                tp.UpdatedAt = now;
            }

            await _db.SaveChangesAsync();
        }
    }
}
