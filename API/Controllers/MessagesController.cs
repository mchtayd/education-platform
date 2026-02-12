//MessagesController.cs
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
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public MessagesController(AppDbContext db) => _db = db;

        private int CurrentUserId()
        {
            var v =
                User.FindFirstValue("id") ??
                User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(v)) throw new Exception("UserId claim not found");
            return int.Parse(v);
        }

        // ✅ Admin proje filtresi için
        // GET /api/Messages/projects
        [HttpGet("projects")]
        public async Task<IActionResult> Projects()
        {
            var projects = await _db.Projects.AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new { id = x.Id, name = x.Name })
                .ToListAsync();

            return Ok(projects);
        }

        // GET /api/Messages/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            var count = await _db.SupportMessages.AsNoTracking()
                .CountAsync(m => !m.IsFromAdmin && m.ReadAtAdmin == null);

            return Ok(new { count });
        }

        // ✅ GET /api/Messages/threads?search=&projectId=
        [HttpGet("threads")]
        public async Task<IActionResult> Threads([FromQuery] string? search, [FromQuery] int? projectId)
        {
            var q = _db.SupportThreads
                .Include(t => t.User)
                .Include(t => t.Project)
                .AsNoTracking()
                .AsQueryable();

            if (projectId.HasValue)
                q = q.Where(t => t.ProjectId == projectId.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                q = q.Where(t =>
                    (t.Subject ?? "").ToLower().Contains(s) ||
                    t.User.Email.ToLower().Contains(s) ||
                    (t.User.Name + " " + t.User.Surname).ToLower().Contains(s) ||
                    (t.Project != null && t.Project.Name.ToLower().Contains(s))
                );
            }

            var data = await q
                .OrderByDescending(t => t.LastMessageAt)
                .Select(t => new
                {
                    id = t.Id,
                    userId = t.UserId,
                    userName = t.User.Name + " " + t.User.Surname,
                    userEmail = t.User.Email,

                    // ✅ proje bilgisi
                    projectId = t.ProjectId,
                    projectName = t.Project != null ? t.Project.Name : "(Proje yok)",

                    subject = t.Subject ?? "(Konu yok)",
                    lastMessageAt = t.LastMessageAt,
                    lastMessagePreview = _db.SupportMessages
                        .Where(m => m.ThreadId == t.Id)
                        .OrderByDescending(m => m.Id)
                        .Select(m => m.Body)
                        .FirstOrDefault(),
                    unreadCount = _db.SupportMessages.Count(m => m.ThreadId == t.Id && !m.IsFromAdmin && m.ReadAtAdmin == null),
                    isClosed = t.IsClosed
                })
                .ToListAsync();

            return Ok(data);
        }

        // GET /api/Messages/threads/{id}
        [HttpGet("threads/{id:int}")]
        public async Task<IActionResult> ThreadDetail(int id)
        {
            var thread = await _db.SupportThreads
                .Include(t => t.User)
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (thread is null) return NotFound();

            // admin açınca user mesajlarını okundu işaretle (global)
            var now = DateTimeOffset.UtcNow;
            var toRead = await _db.SupportMessages
                .Where(m => m.ThreadId == id && !m.IsFromAdmin && m.ReadAtAdmin == null)
                .ToListAsync();

            foreach (var m in toRead) m.ReadAtAdmin = now;
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
                    createdAt = m.CreatedAt,
                    readAtAdmin = m.ReadAtAdmin,
                    readAtUser = m.ReadAtUser
                })
                .ToListAsync();

            return Ok(new
            {
                id = thread.Id,

                projectId = thread.ProjectId,
                projectName = thread.Project != null ? thread.Project.Name : "(Proje yok)",

                subject = thread.Subject ?? "(Konu yok)",
                userId = thread.UserId,
                userName = thread.User.Name + " " + thread.User.Surname,
                userEmail = thread.User.Email,
                createdAt = thread.CreatedAt,
                lastMessageAt = thread.LastMessageAt,
                isClosed = thread.IsClosed,
                messages
            });
        }

        // DELETE /api/Messages/threads/{id}
[HttpDelete("threads/{id:int}")]
public async Task<IActionResult> DeleteThread(int id)
{
    var thread = await _db.SupportThreads.FirstOrDefaultAsync(t => t.Id == id);
    if (thread is null) return NotFound();

    _db.SupportThreads.Remove(thread); // cascade -> messages
    await _db.SaveChangesAsync();

    return Ok(new { ok = true });
}

// DELETE /api/Messages/threads   (tüm konuşmalar)
[HttpDelete("threads")]
public async Task<IActionResult> DeleteAllThreads()
{
    // ⚠️ tüm konuşmalar silinir
    var all = await _db.SupportThreads.ToListAsync();
    _db.SupportThreads.RemoveRange(all);
    var deleted = await _db.SaveChangesAsync();

    return Ok(new { ok = true, deletedRows = deleted });
}

// DELETE /api/Messages/messages/{messageId}
[HttpDelete("messages/{messageId:int}")]
public async Task<IActionResult> DeleteMessage(int messageId)
{
    var msg = await _db.SupportMessages
        .Include(m => m.Thread)
        .FirstOrDefaultAsync(m => m.Id == messageId);

    if (msg is null) return NotFound();

    var thread = msg.Thread;

    _db.SupportMessages.Remove(msg);
    await _db.SaveChangesAsync();

    // thread içinde mesaj kaldı mı?
    var last = await _db.SupportMessages.AsNoTracking()
        .Where(m => m.ThreadId == thread.Id)
        .OrderByDescending(m => m.CreatedAt)
        .Select(m => new { m.CreatedAt })
        .FirstOrDefaultAsync();

    if (last is null)
    {
        // hiç mesaj kalmadı -> thread'i de sil
        _db.SupportThreads.Remove(thread);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, threadDeleted = true });
    }

    // timestamps güncelle
    thread.UpdatedAt = DateTimeOffset.UtcNow;
    thread.LastMessageAt = last.CreatedAt;
    await _db.SaveChangesAsync();

    return Ok(new { ok = true, threadDeleted = false });
}

        public record SendAdminMessageDto(string message);

        // POST /api/Messages/threads/{id}/messages
        [HttpPost("threads/{id:int}/messages")]
        public async Task<IActionResult> SendAdminMessage(int id, [FromBody] SendAdminMessageDto dto)
        {
            if (dto is null || string.IsNullOrWhiteSpace(dto.message))
                return BadRequest(new { message = "Mesaj boş olamaz." });

            var thread = await _db.SupportThreads.FirstOrDefaultAsync(t => t.Id == id);
            if (thread is null) return NotFound();

            if (thread.IsClosed)
                return BadRequest(new { message = "Bu konuşma kapatılmış." });

            var now = DateTimeOffset.UtcNow;

            var msg = new SupportMessage
            {
                ThreadId = id,
                SenderUserId = CurrentUserId(),
                IsFromAdmin = true,
                Body = dto.message.Trim(),
                CreatedAt = now,
                ReadAtAdmin = now,
                ReadAtUser = null
            };

            _db.SupportMessages.Add(msg);

            thread.UpdatedAt = now;
            thread.LastMessageAt = now;

            await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }
    }
}
