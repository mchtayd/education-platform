// Models/SupportThread.cs
using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class SupportThread
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        // ✅ Proje seçimi (eski kayıtlar bozulmasın diye nullable)
        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        // ✅ Sınav attempt'e bağlamak için (eski kayıtlar bozulmasın diye nullable)
        public int? ExamAttemptId { get; set; }
        public ExamAttempt? ExamAttempt { get; set; }

        [MaxLength(200)]
        public string? Subject { get; set; } // ✅ Konu

        public bool IsClosed { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
        public DateTimeOffset LastMessageAt { get; set; }

        public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
    }
}
