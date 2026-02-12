//API/Models/TrainingCategory.cs
namespace API.Models
{
    public class TrainingCategory
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public ICollection<Training> Trainings { get; set; } = new List<Training>();
    }
}
