<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\CategoryType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate(['type' => ['sometimes', Rule::enum(CategoryType::class)]]);

        $categories = Category::visibleTo($request->user())
            ->when($data['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->orderByRaw('user_id is not null') // system defaults first
            ->orderBy('name')
            ->get();

        return CategoryResource::collection($categories);
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $category = new Category($request->validated());
        $category->user_id = $request->user()->id;
        $category->save();

        return (new CategoryResource($category))->response()->setStatusCode(201);
    }

    public function update(CategoryRequest $request, Category $category): CategoryResource
    {
        Gate::authorize('update', $category);

        $category->update($request->validated());

        return new CategoryResource($category);
    }

    public function destroy(Category $category): Response
    {
        Gate::authorize('delete', $category);

        $count = Transaction::withTrashed()->where('category_id', $category->id)->count();
        abort_if($count > 0, 409, "Danh mục đang được dùng trong {$count} giao dịch. Bạn có thể đổi tên thay vì xoá.");

        $category->delete();

        return response()->noContent();
    }
}
