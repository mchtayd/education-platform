// DTOs/RegisterRequest.cs
using System.ComponentModel.DataAnnotations;

namespace API.DTOs
{
    public class RegisterRequest
    {
        [Required, MinLength(2)]
        public string Name { get; set; } = null!;

        [Required, MinLength(2)]
        public string Surname { get; set; } = null!;

        [Required, EmailAddress]
        public string Email { get; set; } = null!;

        [Required]
        public string Phone { get; set; } = null!;

        [Required]
        public string Institution { get; set; } = null!;

        [Required]
        public string BusinessAddress { get; set; } = null!;

        [Required, MinLength(6)]
        public string Password { get; set; } = null!;

        [Required]
        public bool KvkkAccepted { get; set; }
    }
}
