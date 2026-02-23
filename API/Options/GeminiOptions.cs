namespace API.Options;

public class GeminiOptions
{
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/";
    public string ApiKey { get; set; } = "";
    public string ChatModel { get; set; } = "gemini-3-flash-preview"; // free/use-case için hızlı
    public string EmbeddingModel { get; set; } = "gemini-embedding-001";
    public int TimeoutSeconds { get; set; } = 120;
}