namespace API.Options;

public class GeminiOptions
{
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/";
    public string ApiKey { get; set; } = "AIzaSyBuQH6uQvJ09d76MogfqwNYPivWW5pVIPI"; // appsettings veya ENV: GEMINI_API_KEY
    public string ChatModel { get; set; } = "gemini-3-flash-preview"; // free/use-case için hızlı
    public string EmbeddingModel { get; set; } = "gemini-embedding-001";
    public int TimeoutSeconds { get; set; } = 120;
}