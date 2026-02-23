namespace API.Services;

public enum AiEmbeddingPurpose
{
    Document,
    Query
}

public interface IAiProvider
{
    string Name { get; }
    Task<float[]> EmbedAsync(string text, AiEmbeddingPurpose purpose, CancellationToken ct = default);
    Task<string> ChatAsync(List<ChatMessage> messages, CancellationToken ct = default);
}

public interface IAiProviderFactory
{
    IAiProvider Get(string? providerName);
    IReadOnlyList<string> AvailableProviders { get; }
}