// DTOs/AuthResponses.cs
namespace API.DTOs
{
    public record LoginResponse(string Token, object User);
}
