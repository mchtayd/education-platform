//MyMessagesController.cs
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
    [Authorize]
    public class MyMessagesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public MyMessagesController(AppDbContext db) => _db = db;

        private int CurrentUserId()
        {
            var v =
                User.FindFirstValue("id") ??
                User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(v)) throw new Exception("UserId claim not found");
            return int.Parse(v);
        }

        // ✅ kullanıcı proje seçsin
        // GET /api/MyMessages/projects
        [HttpGet("projects")]
        public async Task<IActionResult> Projects()
        {
            var projects = await _db.Projects.AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new { id = x.Id, name = x.Name })
                .ToListAsync();

            return Ok(projects);
        }

        // GET /api/MyMessages/threads
        [HttpGet("threads")]
        public async Task<IActionResult> Threads()
        {
            var me = CurrentUserId();

            var data = await _db.SupportThreads.AsNoTracking()
                .Include(t => t.Project)
                .Where(t => t.UserId == me)
                .OrderByDescending(t => t.LastMessageAt)
                .Select(t => new
                {
                    id = t.Id,
                    subject = t.Subject ?? "(Konu yok)",

                    projectId = t.ProjectId,
                    projectName = t.Project != null ? t.Project.Name : "(Proje yok)",

                    lastMessageAt = t.LastMessageAt,
                    lastMessagePreview = _db.SupportMessages
                        .Where(m => m.ThreadId == t.Id)
                        .OrderByDescending(m => m.Id)
                        .Select(m => m.Body)
                        .FirstOrDefault(),
                    unreadCount = _db.SupportMessages.Count(m =>
                        m.ThreadId == t.Id && m.IsFromAdmin && m.ReadAtUser == null),
                    isClosed = t.IsClosed
                })
                .ToListAsync();

            return Ok(data);
        }
        // ✅ GET /api/MyMessages/unread-count
        // Kullanıcı tarafında: admin'den gelen ve user tarafından okunmamış mesaj sayısı
        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            var uid = CurrentUserId();

            // Kullanıcının thread'lerindeki admin mesajları (ReadAtUser == null)
            var threadIds = _db.SupportThreads
                .AsNoTracking()
                .Where(t => t.UserId == uid)
                .Select(t => t.Id);

            var count = await _db.SupportMessages
                .AsNoTracking()
                .CountAsync(m =>
                    threadIds.Contains(m.ThreadId) &&
                    m.IsFromAdmin &&
                    m.ReadAtUser == null
                );

            return Ok(new { count });
        }

        // GET /api/MyMessages/threads/{id}
        [HttpGet("threads/{id:int}")]
        public async Task<IActionResult> ThreadDetail(int id)
        {
            var me = CurrentUserId();

            var thread = await _db.SupportThreads
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == me);

            if (thread is null) return NotFound();

            // kullanıcı açınca admin mesajlarını okundu işaretle
            var now = DateTimeOffset.UtcNow;
            var toRead = await _db.SupportMessages
                .Where(m => m.ThreadId == id && m.IsFromAdmin && m.ReadAtUser == null)
                .ToListAsync();

            foreach (var m in toRead) m.ReadAtUser = now;
            if (toRead.Count > 0) await _db.SaveChangesAsync();

            var messages = await _db.SupportMessages.AsNoTracking()
                .Where(m => m.ThreadId == id)
                .OrderBy(m => m.CreatedAt)
                .Select(m => new
                {
                    id = m.Id,
                    isFromAdmin = m.IsFromAdmin,
                    senderUserId = m.SenderUserId,
                    body = m.Body,
                    createdAt = m.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                id = thread.Id,
                subject = thread.Subject ?? "(Konu yok)",

                projectId = thread.ProjectId,
                projectName = thread.Project != null ? thread.Project.Name : "(Proje yok)",

                createdAt = thread.CreatedAt,
                lastMessageAt = thread.LastMessageAt,
                isClosed = thread.IsClosed,
                messages
            });
        }
        // DELETE /api/MyMessages/threads/{id}
[HttpDelete("threads/{id:int}")]
public async Task<IActionResult> DeleteMyThread(int id)
{
    var me = CurrentUserId();

    var thread = await _db.SupportThreads
        .FirstOrDefaultAsync(t => t.Id == id && t.UserId == me);

    if (thread is null) return NotFound();

    _db.SupportThreads.Remove(thread); // cascade -> messages
    await _db.SaveChangesAsync();

    return Ok(new { ok = true });
}
// DELETE /api/MyMessages/threads  (kullanıcının tüm konuşmaları)
[HttpDelete("threads")]
public async Task<IActionResult> DeleteAllMyThreads()
{
    var uid = CurrentUserId();

    var mine = await _db.SupportThreads.Where(t => t.UserId == uid).ToListAsync();
    _db.SupportThreads.RemoveRange(mine);
    var deleted = await _db.SaveChangesAsync();

    return Ok(new { ok = true, deletedRows = deleted });
}
// DELETE /api/MyMessages/messages/{messageId}
[HttpDelete("messages/{messageId:int}")]
public async Task<IActionResult> DeleteMyMessage(int messageId)
{
    var me = CurrentUserId();

    var msg = await _db.SupportMessages
        .Include(m => m.Thread)
        .FirstOrDefaultAsync(m => m.Id == messageId);

    if (msg is null) return NotFound();

    // ✅ Kullanıcı sadece kendi thread'inde ve kendi gönderdiği USER mesajını silebilsin
    if (msg.Thread.UserId != me) return Forbid();
    if (msg.IsFromAdmin) return Forbid();
    if (msg.SenderUserId != me) return Forbid();

    var thread = msg.Thread;

    _db.SupportMessages.Remove(msg);
    await _db.SaveChangesAsync();

    var last = await _db.SupportMessages.AsNoTracking()
        .Where(m => m.ThreadId == thread.Id)
        .OrderByDescending(m => m.CreatedAt)
        .Select(m => new { m.CreatedAt })
        .FirstOrDefaultAsync();

    if (last is null)
    {
        _db.SupportThreads.Remove(thread);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, threadDeleted = true });
    }

    thread.UpdatedAt = DateTimeOffset.UtcNow;
    thread.LastMessageAt = last.CreatedAt;
    await _db.SaveChangesAsync();

    return Ok(new { ok = true, threadDeleted = false });
}

        public record CreateThreadDto(int projectId, string subject, string message);

        // ✅ Proje + Konu + Mesaj zorunlu
        // POST /api/MyMessages/threads
        [HttpPost("threads")]
        public async Task<IActionResult> CreateThread([FromBody] CreateThreadDto dto)
        {
            var me = CurrentUserId();

            var subject = (dto.subject ?? "").Trim();
            var msg = (dto.message ?? "").Trim();

            if (dto.projectId <= 0) return BadRequest(new { message = "Proje seçimi zorunludur." });
            if (string.IsNullOrWhiteSpace(subject)) return BadRequest(new { message = "Konu zorunludur." });
            if (string.IsNullOrWhiteSpace(msg)) return BadRequest(new { message = "Mesaj zorunludur." });

            var projectOk = await _db.Projects.AnyAsync(p => p.Id == dto.projectId);
            if (!projectOk) return BadRequest(new { message = "Seçilen proje bulunamadı." });

            var now = DateTimeOffset.UtcNow;

            var thread = new SupportThread
            {
                UserId = me,
                ProjectId = dto.projectId,
                Subject = subject,
                IsClosed = false,
                CreatedAt = now,
                UpdatedAt = now,
                LastMessageAt = now
            };

            _db.SupportThreads.Add(thread);
            await _db.SaveChangesAsync();

            _db.SupportMessages.Add(new SupportMessage
            {
                ThreadId = thread.Id,
                SenderUserId = me,
                IsFromAdmin = false,
                Body = msg,
                CreatedAt = now,
                ReadAtUser = now,
                ReadAtAdmin = null
            });

            await _db.SaveChangesAsync();

            return Ok(new { threadId = thread.Id });
        }

        public record SendUserMessageDto(string message);

        // POST /api/MyMessages/threads/{id}/messages
        [HttpPost("threads/{id:int}/messages")]
        public async Task<IActionResult> SendMessage(int id, [FromBody] SendUserMessageDto dto)
        {
            var me = CurrentUserId();

            var msg = (dto.message ?? "").Trim();
            if (string.IsNullOrWhiteSpace(msg))
                return BadRequest(new { message = "Mesaj boş olamaz." });

            var thread = await _db.SupportThreads.FirstOrDefaultAsync(t => t.Id == id && t.UserId == me);
            if (thread is null) return NotFound();

            if (thread.IsClosed)
                return BadRequest(new { message = "Bu konuşma kapatılmış." });

            var now = DateTimeOffset.UtcNow;

            _db.SupportMessages.Add(new SupportMessage
            {
                ThreadId = id,
                SenderUserId = me,
                IsFromAdmin = false,
                Body = msg,
                CreatedAt = now,
                ReadAtUser = now,
                ReadAtAdmin = null
            });

            thread.UpdatedAt = now;
            thread.LastMessageAt = now;

            await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }
    }
}
