// API/Models/TrainingAssignment.cs
using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class TrainingAssignment
    {
        public int Id { get; set; }

        public int TrainingId { get; set; }
        public Training Training { get; set; } = null!;

        public int? UserId { get; set; }
        public User? User { get; set; }

        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        // ✅ yeni: yayından kalkma zamanı (opsiyonel)
        public DateTimeOffset? UnpublishAt { get; set; }
    }
}
