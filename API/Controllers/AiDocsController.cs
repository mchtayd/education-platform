using API.Data;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "admin,trainer,educator")]
public class AiDocsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AiRagService _rag;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AiDocsController> _logger;

    public AiDocsController(AppDbContext db, AiRagService rag, IWebHostEnvironment env, ILogger<AiDocsController> logger)
    {
        _db = db;
        _rag = rag;
        _env = env;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var docs = await _db.AIDocuments
            .OrderByDescending(x => x.UploadedAt)
            .Select(x => new
            {
                x.Id,
                x.FileName,
                x.SizeBytes,
                x.UploadedAt
            })
            .ToListAsync();

        return Ok(docs);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(50_000_000)] // 50MB
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        [FromQuery] string? provider,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Dosya zorunlu." });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Sadece PDF kabul edilir." });

        var dir = Path.Combine(_env.ContentRootPath, "uploads", "ai_docs");
        Directory.CreateDirectory(dir);

        var stored = $"{Guid.NewGuid():N}.pdf";
        var path = Path.Combine(dir, stored);

        try
        {
            await using (var fs = System.IO.File.Create(path))
                await file.CopyToAsync(fs, ct);

            var doc = new AIDocument
            {
                FileName = file.FileName,
                StoredFileName = stored,
                SizeBytes = file.Length,
                UploadedAt = DateTimeOffset.UtcNow
            };

            _db.AIDocuments.Add(doc);
            await _db.SaveChangesAsync(ct);

            // indexle (provider seçimine göre)
            await _rag.IndexDocumentAsync(doc.Id, path, provider, ct);

            return Ok(new
            {
                id = doc.Id,
                provider = string.IsNullOrWhiteSpace(provider) ? "(default)" : provider,
                message = "Yüklendi ve indexlendi."
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "AI doc upload/index validation error");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI doc upload/index failed");

            // Yarım kalan dosyayı temizle
            try
            {
                if (System.IO.File.Exists(path))
                    System.IO.File.Delete(path);
            }
            catch { /* ignore */ }

            return StatusCode(500, new { message = "Doküman yükleme/indexleme sırasında hata oluştu." });
        }
    }

    [HttpPost("{id:int}/reindex")]
    public async Task<IActionResult> Reindex(int id, [FromQuery] string? provider, CancellationToken ct)
    {
        var doc = await _db.AIDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (doc is null) return NotFound();

        var path = Path.Combine(_env.ContentRootPath, "uploads", "ai_docs", doc.StoredFileName);
        if (!System.IO.File.Exists(path))
            return NotFound(new { message = "Dosya bulunamadı." });

        try
        {
            await _rag.IndexDocumentAsync(doc.Id, path, provider, ct);
            return Ok(new { provider = string.IsNullOrWhiteSpace(provider) ? "(default)" : provider, message = "Reindex tamam." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Reindex failed for docId={DocId}", id);
            return StatusCode(500, new { message = "Reindex sırasında hata oluştu." });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var doc = await _db.AIDocuments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (doc is null) return NotFound();

        var chunks = await _db.AIDocumentChunks.Where(x => x.DocumentId == id).ToListAsync(ct);
        if (chunks.Count > 0) _db.AIDocumentChunks.RemoveRange(chunks);

        _db.AIDocuments.Remove(doc);
        await _db.SaveChangesAsync(ct);

        var path = Path.Combine(_env.ContentRootPath, "uploads", "ai_docs", doc.StoredFileName);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);

        return NoContent();
    }
}