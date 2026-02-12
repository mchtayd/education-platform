using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class Institution
    {
        public int Id { get; set; }

        [MaxLength(200)]
        public string Name { get; set; } = null!;
    }
}
