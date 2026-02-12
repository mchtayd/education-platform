//Controllers/ProjectsController.cs
using API.Data;
using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "admin")] // admin ekranından yönetilecek
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ProjectsController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var data = await _db.Projects
                .AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new { x.Id, x.Name })
                .ToListAsync();

            return Ok(data);
        }

        public class CreateProjectDto
        {
            public string Name { get; set; } = "";
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateProjectDto dto)
        {
            var name = (dto.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Proje adı zorunludur." });

            var exists = await _db.Projects.AnyAsync(x => x.Name.ToLower() == name.ToLower());
            if (exists)
                return Conflict(new { message = "Bu proje adı zaten var." });

            var p = new Project { Name = name };
            _db.Projects.Add(p);
            await _db.SaveChangesAsync();

            return Ok(new { p.Id, p.Name });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var p = await _db.Projects.FirstOrDefaultAsync(x => x.Id == id);
            if (p == null) return NotFound(new { message = "Proje bulunamadı." });

            _db.Projects.Remove(p);

            try
            {
                await _db.SaveChangesAsync();
                return Ok(new { message = "Proje silindi." });
            }
            catch (DbUpdateException ex)
            {
                // FK davranışların çoğu SetNull; yine de beklenmedik kısıt olabilir.
                return BadRequest(new
                {
                    message = "Proje silinemedi (ilişkili kayıtlar olabilir).",
                    detail = ex.InnerException?.Message ?? ex.Message
                });
            }
        }
    }
}
