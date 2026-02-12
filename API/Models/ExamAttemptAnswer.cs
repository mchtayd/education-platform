//Models/ExamAttemptAnswer.cs
using System;
using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class ExamAttemptAnswer
    {
        public int Id { get; set; }

        [Required]
        public int AttemptId { get; set; }
        public ExamAttempt Attempt { get; set; } = default!;

        [Required]
        public int QuestionId { get; set; }
        public ExamQuestion Question { get; set; } = default!;

        // seçilmediyse null olabilir (boş bırakma vs.)
        public int? ChoiceId { get; set; }
        public ExamChoice? Choice { get; set; }

        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
