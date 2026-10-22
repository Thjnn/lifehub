<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Minimal client for the Gemini REST API (generateContent with function calling).
 * Only ever called from the backend (spec §5, §9.5).
 */
class Gemini
{
    private const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    /**
     * @param  list<array<string, mixed>>  $contents  Gemini "contents" (role user|model, parts)
     * @param  list<array<string, mixed>>  $functions  function declarations
     * @return array{parts: list<array<string, mixed>>, usage: array<string, mixed>|null, model: string}
     *
     * @throws AiUnavailable
     */
    public function generate(string $system, array $contents, array $functions = []): array
    {
        $key = config('services.gemini.key');
        $model = config('services.gemini.model');
        if (! $key) {
            throw new AiUnavailable('AI Coach chưa được cấu hình (thiếu GEMINI_API_KEY).');
        }

        $body = [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => $contents,
            // Generous output budget: on newer models internal 'thinking' tokens count against it too.
            'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 4096],
        ];
        if ($functions) {
            $body['tools'] = [['functionDeclarations' => $functions]];
        }

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $key])
                ->timeout(config('services.gemini.timeout'))
                ->post(self::BASE.$model.':generateContent', $body);
        } catch (ConnectionException) {
            throw new AiUnavailable('AI Coach phản hồi quá lâu, vui lòng thử lại.');
        }

        if ($response->status() === 429) {
            throw new AiUnavailable('AI Coach đang quá tải (hết hạn mức miễn phí), thử lại sau ít phút.');
        }
        if ($response->status() === 404) {
            throw new AiUnavailable("Không tìm thấy model \"{$model}\". Kiểm tra biến GEMINI_MODEL.");
        }
        if ($response->failed()) {
            throw new AiUnavailable('AI Coach đang gặp lỗi, vui lòng thử lại sau.');
        }

        $parts = $response->json('candidates.0.content.parts');
        if (! is_array($parts) || $parts === []) {
            // e.g. blocked by safety filters or an empty candidate
            throw new AiUnavailable('AI Coach không trả lời được câu này. Hãy thử diễn đạt khác.');
        }

        return ['parts' => $parts, 'usage' => $response->json('usageMetadata'), 'model' => $model];
    }
}
