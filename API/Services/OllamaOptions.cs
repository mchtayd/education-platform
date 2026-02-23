namespace API.Options;

public class OllamaOptions
{
    public string BaseUrl { get; set; } = "http://127.0.0.1:11434";
    public string ChatModel { get; set; } = "llama3.1:8b";
    public string EmbedModel { get; set; } = "bge-m3:latest";
}