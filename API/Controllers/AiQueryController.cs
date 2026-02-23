using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "admin,trainer,educator,user")] // ✅ admin -> admin,trainer,educator,user
public class AiQueryController : ControllerBase
{
    private readonly AiRagService _rag;
    private readonly ILogger<AiQueryController> _logger;

    public AiQueryController(AiRagService rag, ILogger<AiQueryController> logger)
    {
        _rag = rag;
        _logger = logger;
    }

    public sealed class AskBody
    {
        public string Question { get; set; } = "";
        public int TopK { get; set; } = 8;

        // ✅ frontend switch değeri
        public string? Provider { get; set; } // "ollama" | "gemini"
    }

    [HttpPost("ask")]
    public async Task<IActionResult> Ask([FromBody] AskBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Question))
            return BadRequest(new { message = "Soru zorunlu." });

        try
        {
            var topK = body.TopK <= 0 ? 8 : body.TopK;
            var provider = string.IsNullOrWhiteSpace(body.Provider) ? null : body.Provider.Trim().ToLowerInvariant();

            var (answer, sources) = await _rag.AskAsync(
                body.Question.Trim(),
                topK,
                provider,
                ct);

            return Ok(new
            {
                provider = provider ?? "(default)",
                answer,
                sources
            });
        }
        catch (InvalidOperationException ex)
        {
            // Gemini key yok, provider yanlış vs -> 400
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI query failed");
            return StatusCode(500, new { message = "AI sorgusu sırasında beklenmeyen hata oluştu." });
        }
    }
}