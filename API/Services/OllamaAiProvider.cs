namespace API.Services;

public class OllamaAiProvider : IAiProvider
{
    private readonly OllamaClient _ollama;

    public OllamaAiProvider(OllamaClient ollama)
    {
        _ollama = ollama;
    }

    public string Name => "ollama";

    public Task<float[]> EmbedAsync(string text, AiEmbeddingPurpose purpose, CancellationToken ct = default)
    {
        // purpose şu an kullanılmıyor ama arayüz uyumluluğu için var
        return _ollama.EmbedAsync(text, ct);
    }

    public Task<string> ChatAsync(List<ChatMessage> messages, CancellationToken ct = default)
    {
        return _ollama.ChatAsync(messages, ct);
    }
}