/**
 * A namespace containing math utilities.
 */
export var MathUtils;
(function (MathUtils) {
    /** Adds two numbers. */
    function add(a, b) {
        return a + b;
    }
    MathUtils.add = add;
    /** Subtracts two numbers. */
    function subtract(a, b) {
        return a - b;
    }
    MathUtils.subtract = subtract;
    /** A nested namespace. */
    let Advanced;
    (function (Advanced) {
        function power(base, exponent) {
            return Math.pow(base, exponent);
        }
        Advanced.power = power;
    })(Advanced = MathUtils.Advanced || (MathUtils.Advanced = {}));
})(MathUtils || (MathUtils = {}));
