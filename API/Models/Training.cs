// API/Models/Training.cs
namespace API.Models
{
    public class Training
    {
        public int Id { get; set; }
        public int CategoryId { get; set; }
        public TrainingCategory Category { get; set; } = null!;

        public string Title { get; set; } = "";
        public string ContentType { get; set; } = "PDF";
        public DateTime Date { get; set; }
        public string FileUrl { get; set; } = "";
        public string? PublisherEmail { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        // BUNLAR ŞART (aksi halde Training.ProjectId shadow olur)
        public int? ProjectId { get; set; }
        public Project? Project { get; set; }
    }
}
