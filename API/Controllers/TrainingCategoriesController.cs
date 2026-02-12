using API.Data;
using API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TrainingCategoriesController : ControllerBase
    {
        private readonly AppDbContext _db;
        public TrainingCategoriesController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> Get()
            => Ok(await _db.TrainingCategories.OrderBy(x => x.Name)
                .Select(x => new { x.Id, x.Name }).ToListAsync());

        [HttpPost]
        public async Task<IActionResult> Post([FromBody] TrainingCategory dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Ad zorunlu" });
            var name = dto.Name.Trim();
            if (await _db.TrainingCategories.AnyAsync(x => x.Name.ToLower() == name.ToLower()))
                return Conflict(new { message = "Bu kategori zaten var." });

            var cat = new TrainingCategory { Name = name };
            _db.TrainingCategories.Add(cat);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = cat.Id }, new { cat.Id, cat.Name });
        }
    }
}
