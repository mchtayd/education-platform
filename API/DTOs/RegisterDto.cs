// DTOs/UserDto.cs
public sealed class RegisterDto
    {
        public string Name { get; set; } = "";
        public string Surname { get; set; } = "";
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Institution { get; set; } = "";
        public string BusinessAddress { get; set; } = "";
        public string Password { get; set; } = "";
        public int? ProjectId { get; set; }
    }