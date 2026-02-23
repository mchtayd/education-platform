namespace API.DTOs
{
    public class ForgotPasswordVerifyCodeDto
    {
        public int VerificationId { get; set; }
        public string? Email { get; set; }
        public string? Code { get; set; }
    }
}
