//AccountRequest.cs
using System.ComponentModel.DataAnnotations;
namespace API.Models
{
    // Kayıt formundan gelen talepleri burada tutuyoruz
    public class AccountRequest
    {
        public int Id { get; set; }

        [MaxLength(100)] public string Name { get; set; } = null!;
        [MaxLength(100)] public string Surname { get; set; } = null!;
        [MaxLength(200)] public string Email { get; set; } = null!;

        [MaxLength(30)] public string? Phone { get; set; }
        [MaxLength(200)] public string? Institution { get; set; }
        [MaxLength(300)] public string? BusinessAddress { get; set; }

        // kayıt formunda girilen parola hash’i ( düz parola tutmuyoruz )
        [MaxLength(200)] public string PasswordHash { get; set; } = null!;

        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
