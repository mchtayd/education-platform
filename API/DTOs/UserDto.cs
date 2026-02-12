// DTOs/UserDto.cs
namespace API.DTOs
{
    public record UserDto(
        int Id,
        string Name,
        string Surname,
        string Email,
        string Phone,
        string Institution,
        string BusinessAddress,
        DateTimeOffset CreatedAt
    );
}
