using System.ComponentModel.DataAnnotations;

namespace API.Models
{
    public class EmailVerification
    {
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Email { get; set; } = "";

        [Required, MaxLength(64)]
        public string Salt { get; set; } = "";

        [Required, MaxLength(200)]
        public string CodeHash { get; set; } = "";

        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }

        public int Attempts { get; set; }

        // ✅ Register doğrulama için (eski akışı bozmaz)
        public DateTimeOffset? VerifiedAt { get; set; }

        // ✅ Akış ayrımı (register / forgot_password)
        [MaxLength(40)]
        public string Purpose { get; set; } = "register";

        // ✅ Forgot-password: reset token üretimi için
        [MaxLength(64)]
        public string? ResetSalt { get; set; }

        [MaxLength(200)]
        public string? ResetHash { get; set; }

        // ✅ Forgot-password tamamlandı mı?
        public DateTimeOffset? UsedAt { get; set; }
    }
}
