<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Spec §15.5: event location (plain text, opened in the phone's maps app) and the city used for the weather
 * forecast — chosen in Settings instead of asking for geolocation permission.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('location', 255)->nullable()->after('description');
        });

        Schema::table('user_settings', function (Blueprint $table) {
            $table->string('city_name', 120)->nullable()->after('theme');
            $table->decimal('latitude', 8, 5)->nullable()->after('city_name');
            $table->decimal('longitude', 8, 5)->nullable()->after('latitude');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('events', fn (Blueprint $table) => $table->dropColumn('location'));
        Schema::table('user_settings', fn (Blueprint $table) => $table->dropColumn(['city_name', 'latitude', 'longitude']));
    }
};
