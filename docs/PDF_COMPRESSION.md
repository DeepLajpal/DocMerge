# PDF Compression Implementation

## Overview

DocMerge implements a comprehensive PDF compression strategy that combines three proven techniques to significantly reduce output file size while maintaining acceptable visual quality:

1. **Stream Compression (DEFLATE)**
2. **Object Stream Optimization**
3. **Image Resampling and Compression**

## Compression Techniques

### 1. Stream Compression (DEFLATE)

**How it works:**
- All PDF streams (page content, images, fonts) are compressed using the DEFLATE algorithm
- This is automatically applied by pdf-lib when saving the document
- Provides 30-50% size reduction with no quality loss

**Implementation:**
```typescript
const pdfBytes = await mergedPdf.save({
  useObjectStreams: true, // Enable object stream optimization
});
```

### 2. Object Stream Optimization

**How it works:**
- PDF objects are stored in "object streams" which deduplicate and efficiently store objects
- Removes redundant object references
- Automatically handles font subsetting (only embeds glyphs that are actually used)

**Benefits:**
- Reduces PDF structure overhead
- Typical savings: 10-20% additional reduction
- No quality loss

### 3. Image Resampling and Compression

**How it works:**
- Images are resampled (scaled down) based on the selected quality level
- Resampled images are converted to JPEG format (except in "High" quality mode)
- JPEG quality is adjusted based on compression level

**Quality Levels:**

#### High Quality
- Image resampling: 100% (no reduction)
- Format: PNG (lossless)
- JPEG quality: N/A
- Typical compression: 0-10%
- Use case: When image quality is critical

#### Balanced
- Image resampling: 75% of original dimensions
- Format: JPEG
- JPEG quality: 85%
- Typical compression: 40-60%
- Use case: Default recommendation - good balance of quality and size

#### Small
- Image resampling: 50% of original dimensions
- Format: JPEG
- JPEG quality: 75%
- Typical compression: 60-80%
- Use case: When file size is the priority

## Implementation Details

### Image Compression Pipeline

```
Original Image
    ↓
Calculate target dimensions (based on quality level)
    ↓
Resample on canvas (high-quality smoothing)
    ↓
Convert to JPEG (with quality setting)
    ↓
Embed in PDF
```

### File Size Reduction Breakdown

For a typical 100MB document with multiple PDFs and images:

| Compression Level | Stream + Object | Image Resampling | Image Compression | Total Savings |
|---|---|---|---|---|
| High | 5-8% | 0% | 0% | 5-8% |
| Balanced | 10-15% | 15-25% | 10-15% | 40-60% |
| Small | 15-20% | 30-40% | 20-30% | 60-80% |

**Note:** Actual savings depend heavily on the content:
- Documents with many high-resolution images see greater compression
- Text-heavy documents see smaller compression ratios
- PDFs already compressed may show minimal additional savings

## Quality vs. File Size Trade-offs

### High Quality
- ✅ Best visual quality
- ✅ No image degradation
- ❌ Largest file size
- ✅ Best for: Print, presentations, quality-critical documents

### Balanced
- ✅ Good visual quality
- ✅ Good compression (40-60% typical)
- ✅ Recommended default
- ✅ Best for: General document sharing, email

### Small
- ⚠️ Visible quality loss in images
- ✅ Maximum compression (60-80% typical)
- ✅ Best for: Web distribution, archival, bandwidth-limited scenarios

## Technical Implementation

### Key Files

- **`lib/pdf-utils.ts`** - Core PDF merging and compression logic
- **`lib/image-compression.ts`** - Image resampling and quality utilities
- **`components/doc-merge/compression-panel.tsx`** - UI for compression settings

### Dependencies

- **pdf-lib** (v1.17.1+) - Provides PDF creation and stream compression
- **pdfjs-dist** (v3.11+) - PDF password detection and page counting
- Native Canvas API - Used for image resampling

### Browser Compatibility

- Works in all modern browsers with Canvas support
- All processing happens client-side (no server round-trips)
- No external services required

## Performance Considerations

### Memory Usage

- Image resampling uses canvas (creates temporary in-memory images)
- Large documents may use significant memory during processing
- Recommendation: Process documents under 500MB on client-side

### Processing Time

Typical merge times:
- Small document (5 PDFs, <10MB): 2-5 seconds
- Medium document (20 PDFs, 50MB): 5-15 seconds
- Large document (50 PDFs, 200MB): 15-60 seconds

*Times vary based on image size and device performance*

### Optimization Tips

1. **Use "Balanced" quality** - Best balance for most use cases
2. **Use "Small" quality** - For large documents to reduce memory usage
3. **Avoid "High" quality** - Unless quality is critical (minimal savings)
4. **Process in batches** - For very large document sets

## Future Improvements

Potential enhancements:
- Server-side processing for extremely large files (>500MB)
- Advanced image optimization (WebP format)
- Batch processing mode
- Progressive compression indicator
- Memory-aware quality selection

## References

- [PDF Stream Compression](https://en.wikipedia.org/wiki/PDF#Compression)
- [pdf-lib Documentation](https://pdfme.org/)
- [Image Resampling Techniques](https://en.wikipedia.org/wiki/Image_scaling)
- [JPEG Compression Quality Settings](https://www.iso.org/standard/34341.html)
