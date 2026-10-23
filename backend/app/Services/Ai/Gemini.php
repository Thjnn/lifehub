<?php

namespace App\Services\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Sleep;

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
     * @param  array<string, mixed>|null  $schema  structured output: the reply is JSON matching this schema
     * @return array{parts: list<array<string, mixed>>, usage: array<string, mixed>|null, model: string}
     *
     * @throws AiUnavailable
     */
    public function generate(string $system, array $contents, array $functions = [], ?array $schema = null): array
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
            // Temperature left at the model default — Google advises against lowering it for Gemini 3.
            'generationConfig' => ['maxOutputTokens' => 4096],
        ];
        if ($functions) {
            $body['tools'] = [['functionDeclarations' => $functions]];
        }
        if ($schema) {
            // A week of meals is a long JSON reply: give it room.
            $body['generationConfig'] = ['maxOutputTokens' => 8192, 'responseMimeType' => 'application/json', 'responseSchema' => $schema];
        }

        // Free-tier realities: a model can be overloaded (500/503 → retry it once after a pause) or out of quota
        // (429 — quotas are per model, so retrying it is pointless). Either way, the other model gets a turn.
        $fallback = config('services.gemini.fallback_model');
        $models = $fallback && $fallback !== $model ? [$model, $fallback] : [$model];
        foreach ($models as $attemptModel) {
            $model = $attemptModel;
            $response = $this->send($key, $model, $body);
            if (in_array($response->status(), [500, 503], true)) {
                Log::warning('Gemini overloaded, retrying', ['status' => $response->status(), 'model' => $model]);
                Sleep::for(1500)->milliseconds();
                $response = $this->send($key, $model, $body);
            }
            if (! in_array($response->status(), [429, 500, 503], true)) {
                break;
            }
            Log::warning('Gemini unavailable on this model', ['status' => $response->status(), 'model' => $model, 'reason' => mb_substr((string) $response->json('error.message', ''), 0, 300)]);
        }

        if ($response->failed()) {
            $status = $response->status();
            $reason = (string) $response->json('error.message', '');
            // stderr on Render: the provider's own explanation, without the key or the user's data.
            Log::warning('Gemini request failed', ['status' => $status, 'model' => $model, 'reason' => mb_substr($reason, 0, 500)]);

            // 429 details name the exhausted quota, e.g. "GenerateRequestsPerDayPerProjectPerModel-FreeTier".
            $perDay = str_contains(json_encode($response->json('error.details', [])), 'PerDay');

            throw new AiUnavailable(match (true) {
                $status === 429 && $perDay => 'Đã hết lượt AI miễn phí của Google cho hôm nay. Bạn thử lại vào ngày mai nhé.',
                $status === 429 => 'AI Coach đang quá tải (hết lượt miễn phí theo phút), thử lại sau 1 phút.',
                $status === 404 => "Không tìm thấy model \"{$model}\". Kiểm tra biến GEMINI_MODEL.",
                str_contains($reason, 'API key not valid') || str_contains($reason, 'API_KEY_INVALID') => 'GEMINI_API_KEY không hợp lệ. Tạo lại key trong AI Studio và cập nhật trên Render.',
                $status === 403 => 'GEMINI_API_KEY không có quyền dùng Gemini API (key bị chặn hoặc chưa bật API).',
                $status === 400 => "Gemini từ chối yêu cầu (mã 400): {$reason}",
                in_array($status, [500, 503], true) => 'Gemini đang quá tải, vui lòng thử lại sau ít phút.',
                default => "AI Coach đang gặp lỗi (mã {$status}), vui lòng thử lại sau.",
            });
        }

        $parts = $response->json('candidates.0.content.parts');
        if (! is_array($parts) || $parts === []) {
            // e.g. blocked by safety filters or an empty candidate
            throw new AiUnavailable('AI Coach không trả lời được câu này. Hãy thử diễn đạt khác.');
        }

        return ['parts' => $parts, 'usage' => $response->json('usageMetadata'), 'model' => $model];
    }

    /**
     * @param  array<string, mixed>  $body
     *
     * @throws AiUnavailable
     */
    private function send(string $key, string $model, array $body): Response
    {
        try {
            return Http::withHeaders(['x-goog-api-key' => $key])
                ->timeout(config('services.gemini.timeout'))
                ->post(self::BASE.$model.':generateContent', $body);
        } catch (ConnectionException) {
            throw new AiUnavailable('AI Coach phản hồi quá lâu, vui lòng thử lại.');
        }
    }
}
