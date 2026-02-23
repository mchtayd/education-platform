namespace API.DTOs
{
    public class ForgotPasswordResetDto
    {
        public int VerificationId { get; set; }
        public string? Email { get; set; }

        // Kullanıcı mailden gelen link ile geldiyse veya doğrulama sonrası UI sakladıysa
        public string? ResetToken { get; set; }

        public string? NewPassword { get; set; }
    }
}
