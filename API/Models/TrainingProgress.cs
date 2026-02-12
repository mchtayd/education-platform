//API/Models/TrainingProgress.cs
using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    /// <summary>
    /// Kullanıcının bir eğitimdeki ilerlemesi ve geri bildirimi.
    /// Benzersiz anahtar: (UserId, TrainingId)
    /// </summary>
    public class TrainingProgress
    {
        public int Id { get; set; }

        [Required]
        public int TrainingId { get; set; }
        public Training Training { get; set; } = null!;

        [Required]
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        /// <summary>0..100</summary>
        public int Progress { get; set; } = 0;

        public DateTimeOffset? LastViewedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }

        /// <summary>1..5</summary>
        public int? Rating { get; set; }

        [MaxLength(1000)]
        public string? Comment { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
