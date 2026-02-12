namespace API.Models
{
    public class Project
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public ICollection<User>? Users { get; set; } = new List<User>();
        public ICollection<UserProject> UserProjects { get; set; } = new List<UserProject>();
    }
}
