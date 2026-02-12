namespace API.Models
{
    public class User
    {
        public int Id { get; set; }

        public string Name { get; set; } = null!;
        public string Surname { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Phone { get; set; } = null!;
        public string Institution { get; set; } = null!;
        public string BusinessAddress { get; set; } = null!;

        public string PasswordHash { get; set; } = null!;
        public string Role { get; set; } = "user"; // "admin" | "user" | "staff" | "trainer"

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset? KvkkAcceptedAt { get; set; }
        public bool IsActive { get; set; } = true;

        // ✅ Eski yapı korunuyor (primary proje)
        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        // ✅ Yeni: çoklu proje
        public ICollection<UserProject> UserProjects { get; set; } = new List<UserProject>();
        public bool MustChangePassword { get; set; } = false;

    }
}
