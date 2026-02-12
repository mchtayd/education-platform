//FilesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        public FilesController(IWebHostEnvironment env) => _env = env;

        [HttpPost("choice-image")]
        [Authorize(Roles = "admin,trainer,educator")]
        [RequestSizeLimit(1024L * 1024 * 20)] // 20MB
        public async Task<IActionResult> UploadChoiceImage(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Dosya zorunlu.");
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var ok = new[] { ".png", ".jpg", ".jpeg", ".webp", ".gif" }.Contains(ext);
            if (!ok) return BadRequest("Görsel uzantısı geçersiz.");

            var root = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
                "uploads", "exams", "choices");
            Directory.CreateDirectory(root);

            var fn = $"{Guid.NewGuid():N}{ext}";
            using (var fs = System.IO.File.Create(Path.Combine(root, fn)))
                await file.CopyToAsync(fs);

            var url = $"/uploads/exams/choices/{fn}";
            return Ok(new { url });
        }
    }
}
