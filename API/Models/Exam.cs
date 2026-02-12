//Models/Exam.cs
using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class Exam
    {
        public int Id { get; set; }

        [MaxLength(300)]
        public string Title { get; set; } = null!;

        public int? ProjectId { get; set; }   // oluştururken varsayılan proje (opsiyonel)
        public Project? Project { get; set; }

        public int DurationMinutes { get; set; } = 30;

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        public ICollection<ExamQuestion> Questions { get; set; } = new List<ExamQuestion>();
    }

    public class ExamQuestion
    {
        public int Id { get; set; }
        public int ExamId { get; set; }
        public Exam Exam { get; set; } = null!;

        [MaxLength(1000)]
        public string Text { get; set; } = null!;

        public int Order { get; set; } = 0;

        public ICollection<ExamChoice> Choices { get; set; } = new List<ExamChoice>();
    }

    public class ExamChoice
    {
        public int Id { get; set; }
        public int QuestionId { get; set; }
        public ExamQuestion Question { get; set; } = null!;

        [MaxLength(600)]
        public string? ImageUrl { get; set; } // şık görseli (opsiyonel)

        [MaxLength(400)]
        public string? Text { get; set; }     // şık metni (opsiyonel)

        public bool IsCorrect { get; set; } = false;
    }

    // Yayınlama
    public class ExamAssignment
    {
        public int Id { get; set; }

        public int ExamId { get; set; }
        public Exam Exam { get; set; } = null!;

        public int? UserId { get; set; }
        public User? User { get; set; }

        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    // Öğrenci giriş & cevaplar
    public class ExamAttempt
    {
        public int Id { get; set; }
        public int ExamId { get; set; }
        public Exam Exam { get; set; } = null!;

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset? SubmittedAt { get; set; }

        public int? DurationUsedSec { get; set; }

        public double? Score { get; set; }
        public bool? IsPassed { get; set; }

        [MaxLength(600)]
        public string? Note { get; set; }
        public string? ShuffleJson { get; set; }

        public ICollection<ExamAnswer> Answers { get; set; } = new List<ExamAnswer>();
    }

    public class ExamAnswer
    {
        public int Id { get; set; }
        public int AttemptId { get; set; }
        public ExamAttempt Attempt { get; set; } = null!;

        public int QuestionId { get; set; }
        public int ChoiceId { get; set; }
    }
}
