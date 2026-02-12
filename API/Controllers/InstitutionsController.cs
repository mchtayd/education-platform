using API.Data;
using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "admin")] // ✅ Create/Delete admin kalsın
    public class InstitutionsController : ControllerBase
    {
        private readonly AppDbContext _db;
        public InstitutionsController(AppDbContext db) => _db = db;

        // ✅ Register/Login ekranı da kurumları çekebilsin diye public yaptık
        // GET: /api/Institutions
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> List()
        {
            var data = await _db.Institutions.AsNoTracking()
                .OrderBy(x => x.Name)
                .Select(x => new { x.Id, x.Name })
                .ToListAsync();

            return Ok(data);
        }

        public sealed class CreateDto
        {
            public string Name { get; set; } = "";
        }

        // POST: /api/Institutions
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDto dto)
        {
            var name = (dto.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Kurum adı zorunludur." });

            var nameLower = name.ToLowerInvariant();
            var exists = await _db.Institutions.AnyAsync(x => x.Name.ToLower() == nameLower);
            if (exists)
                return Conflict(new { message = "Bu kurum zaten var." });

            var row = new Institution { Name = name };
            _db.Institutions.Add(row);
            await _db.SaveChangesAsync();

            return Ok(new { row.Id, row.Name });
        }

        // DELETE: /api/Institutions/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var row = await _db.Institutions.FindAsync(id);
            if (row is null) return NotFound(new { message = "Kurum bulunamadı." });

            _db.Institutions.Remove(row);
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }
}
