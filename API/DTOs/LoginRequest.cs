// DTOs/LoginRequest.cs
using System.ComponentModel.DataAnnotations;

namespace API.DTOs
{
    public class LoginRequest
    {
        [Required, EmailAddress] public string Email { get; set; } = null!;
        [Required] public string Password { get; set; } = null!;
    }
}
