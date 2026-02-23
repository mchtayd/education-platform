namespace API.Services;

public class GeminiAiProvider : IAiProvider
{
    private readonly GeminiClient _gemini;

    public GeminiAiProvider(GeminiClient gemini)
    {
        _gemini = gemini;
    }

    public string Name => "gemini";

    public Task<float[]> EmbedAsync(string text, AiEmbeddingPurpose purpose, CancellationToken ct = default)
        => _gemini.EmbedAsync(text, purpose, ct);

    public Task<string> ChatAsync(List<ChatMessage> messages, CancellationToken ct = default)
        => _gemini.GenerateContentAsync(messages, ct);
}