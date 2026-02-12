using System.ComponentModel.DataAnnotations;

namespace API.DTOs
{
    public class SendRegisterCodeDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = null!;
    }

    public class VerifyRegisterCodeDto
    {
        [Required]
        public int VerificationId { get; set; }

        [Required, EmailAddress]
        public string Email { get; set; } = null!;

        [Required, MinLength(4), MaxLength(10)]
        public string Code { get; set; } = null!;
    }
}
