using UglyToad.PdfPig;

namespace API.Services;

public class PdfTextExtractor
{
    public string ExtractText(string pdfPath)
    {
        using var doc = PdfDocument.Open(pdfPath);
        var sb = new System.Text.StringBuilder();

        foreach (var page in doc.GetPages())
        {
            var text = page.Text;
            if (!string.IsNullOrWhiteSpace(text))
            {
                sb.AppendLine(text);
                sb.AppendLine();
            }
        }

        return sb.ToString().Trim();
    }
}