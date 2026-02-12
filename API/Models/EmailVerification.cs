using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class EmailVerification
    {
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Email { get; set; } = "";

        // ✅ eğer CodeHash üretirken salt kullanıyorsan bunu DB'de saklamalısın
        [Required, MaxLength(64)]
        public string Salt { get; set; } = "";

        [Required, MaxLength(200)]
        public string CodeHash { get; set; } = "";
        

        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }

        public int Attempts { get; set; }

        public DateTimeOffset? VerifiedAt { get; set; }
    }
}
