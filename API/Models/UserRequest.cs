//UserRequest.cs
namespace API.Models
{
    public class UserRequest
    {
        public int Id { get; set; }

        public string Email { get; set; } = null!;
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Phone { get; set; }
        public string? Institution { get; set; }
        public string? BusinessAddress { get; set; }

        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        // Talep zamanı
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
